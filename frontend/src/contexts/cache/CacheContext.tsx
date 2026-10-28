import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  Contributor,
  ContributorSet,
  SearchParams,
  SearchTarget,
  EnrichedRelease,
} from "../../api/types";
import { db } from "@/services/db";
import {
  CacheContextValue,
  CacheState,
  SaveOptions,
  SearchCache,
  SearchLineage,
} from "./types";
import { calculateReleaseScore } from "@/api/contributorSet";
import { matchingSearchIds } from "@/lib/searchTarget";
import { migrateSearch } from "@/lib/releases";
import { isMainArtistRelease } from "@/lib/results";
import {
  detachedLineage,
  lineageForNewSearch,
  lineageOf,
  SearchOrigin,
} from "@/lib/lineage";
import { coverResolver } from "@/api/coverArt";
import {
  enforceRequired,
  isContributorCounted,
  meetsRequired,
} from "@/lib/filters";

const CacheContext = createContext<CacheContextValue | null>(null);

/**
 * Where earlier versions kept searches that weren't saved. Read once, moved
 * into the library (IndexedDB), and removed: every search is kept now.
 */
const OLD_SESSION_KEY = "vinyl-periphery-cache";

/** Searches an earlier version left in sessionStorage, then forgets them. */
const takeOldSessionSearches = (): SearchCache[] => {
  try {
    const raw = sessionStorage.getItem(OLD_SESSION_KEY);
    if (!raw) return [];
    sessionStorage.removeItem(OLD_SESSION_KEY);
    const parsed = JSON.parse(raw);
    return Object.values(
      (parsed?.searches ?? {}) as Record<string, SearchCache>,
    ).map(migrateSearch);
  } catch {
    return [];
  }
};

/** How long filter changes wait before they're written to the library. */
const FILTER_SAVE_DELAY_MS = 400;
// Kept apart from the cache so its shape doesn't change. localStorage, so a
// bookmarked link to a replaced saved search still finds the newer one.
const REPLACED_STORAGE_KEY = "vinyl-periphery-replaced";

const readReplaced = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(REPLACED_STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
};

export const CacheProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Every search lives in the library (IndexedDB) and loads from there.
  // `savedSearchIds` lists them all: there are no unsaved searches.
  const [state, setState] = React.useState<CacheState>(() => ({
    searches: {},
    activeSearchId: null,
    savedSearchIds: new Set(),
  }));

  // True once saved searches have been read from IndexedDB, so a saved
  // result opened by URL isn't shown as missing while it loads.
  const [savedSearchesLoaded, setSavedSearchesLoaded] = React.useState(false);
  // Old search id -> the id of the search that replaced it (a repeat run of
  // the same album), so links to the old one can follow.
  const [replacedBy, setReplacedBy] =
    React.useState<Record<string, string>>(readReplaced);
  useEffect(() => {
    try {
      localStorage.setItem(REPLACED_STORAGE_KEY, JSON.stringify(replacedBy));
    } catch {
      // Storage full or blocked: old links just show "not available".
    }
  }, [replacedBy]);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Load the library from IndexedDB on mount, after moving in any searches
  // an earlier version left in sessionStorage.
  useEffect(() => {
    const loadSavedSearches = async () => {
      try {
        const old = takeOldSessionSearches();
        const stored = await db.getAllSavedSearches();
        const known = new Set(stored.map((s) => s.searchId));
        const moved = old
          .filter((s) => !known.has(s.searchId))
          .map((s) => ({ ...s, savedAt: s.savedAt ?? Date.now() }));
        for (const search of moved) await db.saveSearch(search);
        const saved = [...stored, ...moved];
        setState((prev) => ({
          ...prev,
          searches: {
            ...prev.searches,
            ...Object.fromEntries(
              saved.map((s) => [s.searchId, migrateSearch(s)]),
            ),
          },
          savedSearchIds: new Set([
            ...prev.savedSearchIds,
            ...saved.map((s) => s.searchId),
          ]),
        }));
      } catch (error) {
        console.error("Failed to load saved searches:", error);
      } finally {
        setSavedSearchesLoaded(true);
      }
    };

    loadSavedSearches();
  }, []);

  const setActiveSearch = useCallback((searchId: string) => {
    setState((prev) => ({
      ...prev,
      activeSearchId: searchId,
    }));
  }, []);

  const clearActiveSearch = useCallback(() => {
    setState((prev) => ({
      ...prev,
      activeSearchId: null,
    }));
  }, []);

  const addSearch = useCallback(
    (
      params: SearchParams,
      contributorSet: ContributorSet,
      releases: Record<string, EnrichedRelease>,
      thumb: string,
      target?: SearchTarget | null,
      origin?: SearchOrigin,
      lineageOverride?: SearchLineage
    ): string => {
      const searchId = `${params.artist}-${params.album}-${Date.now()}`;

      // Convert contributors Map to object and extract all roles
      const contributors: Record<number, Contributor> = {};
      const roles: Record<string, boolean> = {};

      Object.entries(contributorSet.contributors).forEach(
        ([id, contributor]) => {
          contributors[Number(id)] = contributor;
          contributor.roles.forEach((role) => {
            roles[role] = true;
          });
        }
      );

      // Initialize filter state with all contributors and roles included
      const filterState = {
        contributors: Object.keys(contributors).reduce((acc, id) => {
          acc[Number(id)] = true;
          return acc;
        }, {} as Record<number, boolean>),
        roles: Object.keys(roles).reduce((acc, role) => {
          acc[role] = true;
          return acc;
        }, {} as Record<string, boolean>),
        excludeMainArtist: true,
        collaborationsOnly: true,
        excludeVarious: false,
        required: { contributors: [], roles: [] },
      };

      // A repeat run of the same album (same target, or same typed text for
      // searches from before targets) replaces the earlier result rather
      // than sitting beside it.
      const replaced = matchingSearchIds(
        stateRef.current.searches,
        params,
        target
      );
      // A repeat run keeps the trail it was on; a search from a result row
      // continues its parent's; anything else starts one.
      const parent = origin
        ? stateRef.current.searches[origin.parentSearchId]
        : undefined;
      const lineage = lineageOverride ?? lineageForNewSearch({
        searchId,
        replaced: replaced.map((id) => stateRef.current.searches[id]),
        parent,
        origin,
        parentThumb:
          parent?.thumb ||
          (parent?.target && coverResolver.get(parent.target.key)) ||
          "",
      });
      const newSearch: SearchCache = {
        searchId,
        searchParams: params,
        ...(target ? { target } : {}),
        contributors,
        roles,
        releases,
        filterState,
        thumb,
        lineage,
        savedAt: Date.now(),
      };

      setState((prev) => {
        const searches = { ...prev.searches };
        const savedSearchIds = new Set(prev.savedSearchIds);
        replaced.forEach((id) => {
          delete searches[id];
          savedSearchIds.delete(id);
        });
        searches[searchId] = newSearch;
        savedSearchIds.add(searchId);
        return {
          searches,
          activeSearchId: replaced.includes(prev.activeSearchId ?? "")
            ? searchId
            : prev.activeSearchId,
          savedSearchIds,
        };
      });

      if (replaced.length > 0) {
        setReplacedBy((prev) => {
          const next: Record<string, string> = {};
          // Earlier replacements that pointed at a replaced id move on too.
          Object.entries(prev).forEach(([from, to]) => {
            next[from] = replaced.includes(to) ? searchId : to;
          });
          replaced.forEach((id) => (next[id] = searchId));
          return next;
        });
      }
      // Into the library: every search is kept, replacing any earlier run.
      void (async () => {
        try {
          for (const id of replaced) await db.deleteSavedSearch(id);
          await db.saveSearch(newSearch);
        } catch (error) {
          console.error("Failed to keep the search:", error);
        }
      })();

      return searchId;
    },
    []
  );

  const saveSearch = useCallback(
    async (searchId: string, options: SaveOptions = {}) => {
      const search = stateRef.current.searches[searchId];
      if (!search) return;

      try {
        // "Save on its own" (or out of its stack) starts a trail of its own,
        // so it never regroups; joining another stack replaces it.
        const savedSearch: SearchCache = {
          ...search,
          lineage: options.withoutLineage
            ? detachedLineage(searchId)
            : (options.lineage ?? search.lineage),
          savedAt: Date.now(),
        };
        await db.saveSearch(savedSearch);
        setState((prev) => ({
          ...prev,
          searches: {
            ...prev.searches,
            [searchId]: savedSearch,
          },
          savedSearchIds: new Set([...prev.savedSearchIds, searchId]),
        }));
      } catch (error) {
        console.error("Failed to save search:", error);
        throw error;
      }
    },
    []
  );

  /** Deletes every saved search in a stack. Returns how many. */
  const deleteStack = useCallback(async (stackId: string) => {
    const ids = Object.values(stateRef.current.searches)
      .filter(
        (s) =>
          stateRef.current.savedSearchIds.has(s.searchId) &&
          lineageOf(s).stackId === stackId
      )
      .map((s) => s.searchId);
    for (const id of ids) await db.deleteSavedSearch(id);
    setState((prev) => {
      const searches = { ...prev.searches };
      const savedSearchIds = new Set(prev.savedSearchIds);
      ids.forEach((id) => {
        delete searches[id];
        savedSearchIds.delete(id);
      });
      return {
        searches,
        activeSearchId: ids.includes(prev.activeSearchId ?? "")
          ? null
          : prev.activeSearchId,
        savedSearchIds,
      };
    });
    return ids.length;
  }, []);

  /**
   * Breaks a stack up: every saved search in it stays saved, each on a trail
   * of its own. Returns how many.
   */
  const disbandStack = useCallback(async (stackId: string) => {
    const members = Object.values(stateRef.current.searches).filter(
      (s) =>
        stateRef.current.savedSearchIds.has(s.searchId) &&
        lineageOf(s).stackId === stackId
    );
    const loose = members.map((s) => ({
      ...s,
      lineage: detachedLineage(s.searchId),
    }));
    for (const search of loose) await db.saveSearch(search);
    setState((prev) => {
      const searches = { ...prev.searches };
      loose.forEach((s) => {
        searches[s.searchId] = s;
      });
      return { ...prev, searches };
    });
    return loose.length;
  }, []);

  /** Puts a deleted search back (undo). */
  const restoreSearch = useCallback(async (search: SearchCache) => {
    await db.saveSearch(search);
    setState((prev) => ({
      ...prev,
      searches: { ...prev.searches, [search.searchId]: search },
      savedSearchIds: new Set([...prev.savedSearchIds, search.searchId]),
    }));
  }, []);

  // Filter changes are written to the library once they settle.
  const filterSaves = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const updateFilterState = useCallback(
    (searchId: string, updates: Partial<SearchCache["filterState"]>) => {
      setState((prev) => ({
        ...prev,
        searches: {
          ...prev.searches,
          [searchId]: {
            ...prev.searches[searchId],
            filterState: enforceRequired(prev.searches[searchId], {
              ...prev.searches[searchId].filterState,
              ...updates,
            }),
          },
        },
      }));
      clearTimeout(filterSaves.current.get(searchId));
      filterSaves.current.set(
        searchId,
        setTimeout(() => {
          filterSaves.current.delete(searchId);
          const search = stateRef.current.searches[searchId];
          if (!search) return;
          db.saveSearch(search).catch((error) =>
            console.error("Failed to keep the filters:", error)
          );
        }, FILTER_SAVE_DELAY_MS)
      );
    },
    []
  );

  const getActiveSearch = useCallback((): SearchCache | null => {
    if (!state.activeSearchId) return null;
    return state.searches[state.activeSearchId] || null;
  }, [state.activeSearchId, state.searches]);

  /** Deletes a search from the library. */
  const deleteSearch = useCallback(async (searchId: string) => {
    clearTimeout(filterSaves.current.get(searchId));
    filterSaves.current.delete(searchId);
    await db.deleteSavedSearch(searchId);
    setState((prev) => {
      const searches = { ...prev.searches };
      delete searches[searchId];
      const savedSearchIds = new Set(prev.savedSearchIds);
      savedSearchIds.delete(searchId);
      return {
        searches,
        activeSearchId:
          prev.activeSearchId === searchId ? null : prev.activeSearchId,
        savedSearchIds,
      };
    });
  }, []);

  const value: CacheContextValue = {
    ...state,
    savedSearchesLoaded,
    replacedBy,
    setActiveSearch,
    clearActiveSearch,
    addSearch,
    saveSearch,
    deleteStack,
    disbandStack,
    restoreSearch,
    updateFilterState,
    getActiveSearch,
    deleteSearch,
  };

  return (
    <CacheContext.Provider value={value}>{children}</CacheContext.Provider>
  );
};

// Custom hook to use the cache context
export const useCache = () => {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error("useCache must be used within a CacheProvider");
  }
  return context;
};

// Custom hook for filter operations
export const useSearchFilters = (searchId: string) => {
  const { searches, updateFilterState } = useCache();
  const search = searches[searchId];

  const toggleContributor = useCallback(
    (contributorId: number) => {
      if (!search) return;
      const currentState = search.filterState.contributors[contributorId];
      updateFilterState(searchId, {
        contributors: {
          ...search.filterState.contributors,
          [contributorId]: !currentState,
        },
      });
    },
    [search, searchId, updateFilterState]
  );

  const toggleRole = useCallback(
    (roleName: string) => {
      if (!search) return;
      const currentState = search.filterState.roles[roleName];
      updateFilterState(searchId, {
        roles: {
          ...search.filterState.roles,
          [roleName]: !currentState,
        },
      });
    },
    [search, searchId, updateFilterState]
  );

  const resetAllFilters = useCallback(() => {
    if (!search) return;
    updateFilterState(searchId, {
      contributors: Object.keys(search.contributors).reduce((acc, id) => {
        acc[Number(id)] = true;
        return acc;
      }, {} as Record<number, boolean>),
      roles: Object.keys(search.roles).reduce((acc, role) => {
        acc[role] = true;
        return acc;
      }, {} as Record<string, boolean>),
    });
  }, [search, searchId, updateFilterState]);

  const excludeAllRoles = useCallback(() => {
    if (!search) return;
    updateFilterState(searchId, {
      contributors: Object.keys(search.contributors).reduce((acc, id) => {
        acc[Number(id)] = true;
        return acc;
      }, {} as Record<number, boolean>),
      roles: Object.keys(search.roles).reduce((acc, role) => {
        acc[role] = false;
        return acc;
      }, {} as Record<string, boolean>),
    });
  }, [search, searchId, updateFilterState]);

  const excludeAllContributors = useCallback(() => {
    if (!search) return;
    updateFilterState(searchId, {
      contributors: Object.keys(search.contributors).reduce((acc, id) => {
        acc[Number(id)] = false;
        return acc;
      }, {} as Record<number, boolean>),
      roles: Object.keys(search.roles).reduce((acc, role) => {
        acc[role] = true;
        return acc;
      }, {} as Record<string, boolean>),
    });
  }, [search, searchId, updateFilterState]);

  const isContributorActive = useCallback(
    (contributorId: number): boolean => {
      if (!search) return false;
      // Switched on, and required or with a role on.
      return isContributorCounted(search, contributorId);
    },
    [search]
  );

  const isRoleActive = useCallback(
    (roleName: string): boolean => {
      if (!search) return false;
      return search.filterState.roles[roleName] ?? false;
    },
    [search]
  );

  const isContributorDisabled = useCallback(
    (contributorId: number): boolean => {
      if (!search) return true;
      const contributor = search.contributors[contributorId];
      if (!contributor) return true;

      // A contributor is disabled only if all their roles are inactive,
      // unless they're required
      if (search.filterState.required?.contributors.includes(contributorId))
        return false;
      return !contributor.roles.some((role) => search.filterState.roles[role]);
    },
    [search]
  );

  const isRoleDisabled = useCallback(
    (roleName: string): boolean => {
      if (!search) return true;

      // A role is disabled if all contributors with this role are inactive
      return !Object.entries(search.contributors).some(([id, contributor]) => {
        const contributorId = Number(id);
        return (
          contributor.roles.includes(roleName) &&
          search.filterState.contributors[contributorId]
        );
      });
    },
    [search]
  );

  const areAllRolesInactive = useCallback((): boolean => {
    if (!search) return true;
    return Object.keys(search.roles).every(
      (role) => !search.filterState.roles[role]
    );
  }, [search]);

  const areAllContributorsInactive = useCallback((): boolean => {
    if (!search) return true;
    return Object.keys(search.contributors).every(
      (id) => !search.filterState.contributors[Number(id)]
    );
  }, [search]);

  const toggleExcludeMainArtist = useCallback(() => {
    if (!search) return;
    updateFilterState(searchId, {
      excludeMainArtist: !search.filterState.excludeMainArtist,
    });
  }, [search, searchId, updateFilterState]);

  const toggleCollaborationsOnly = useCallback(() => {
    if (!search) return;
    updateFilterState(searchId, {
      collaborationsOnly: !search.filterState.collaborationsOnly,
    });
  }, [search, searchId, updateFilterState]);

  const toggleExcludeVarious = useCallback(() => {
    if (!search) return;
    updateFilterState(searchId, {
      excludeVarious: !search.filterState.excludeVarious,
    });
  }, [search, searchId, updateFilterState]);

  return {
    toggleContributor,
    toggleRole,
    resetAllFilters,
    excludeAllRoles,
    excludeAllContributors,
    isContributorActive,
    isRoleActive,
    isContributorDisabled,
    isRoleDisabled,
    areAllRolesInactive,
    areAllContributorsInactive,
    toggleExcludeMainArtist,
    toggleCollaborationsOnly,
    toggleExcludeVarious,
    filterState: search?.filterState,
  };
};

// Custom hook for filtered results
export const useFilteredAndScoredReleases = (searchId: string) => {
  const { searches } = useCache();
  const { isContributorActive } = useSearchFilters(searchId);
  const search = searches[searchId];

  return useMemo(() => {
    if (!search) return { releases: [], count: 0 };

    const processedReleases = Object.values(search.releases)
      .map((release) => {
        // Deduplicate contributors
        const uniqueContributorIds = Array.from(
          new Set(release.contributorIds)
        );

        // Get active contributors for this release
        const activeContributors = uniqueContributorIds.filter((id) =>
          isContributorActive(id)
        );

        // Skip if no active contributors
        if (activeContributors.length === 0) return null;

        // Apply "must include"
        if (!meetsRequired(activeContributors, search)) return null;

        // Apply collaborations only filter
        if (
          search.filterState.collaborationsOnly &&
          activeContributors.length < 2
        ) {
          return null;
        }

        // Apply exclude main artist filter
        if (
          search.filterState.excludeMainArtist &&
          isMainArtistRelease(search, release)
        ) {
          return null;
        }

        if (search.filterState.excludeVarious && release.artist === "Various") {
          return null;
        }

        const { score, confidence } = calculateReleaseScore(
          { ...release, contributorIds: uniqueContributorIds },
          {
            contributors: search.contributors,
            isContributorActive,
          }
        );

        return {
          ...release,
          score,
          confidence,
          activeContributors,
        };
      })
      .filter(
        (release): release is NonNullable<typeof release> => release !== null
      )
      .sort((a, b) => b.score * b.confidence - a.score * a.confidence);

    return {
      releases: processedReleases,
      count: processedReleases.length,
    };
  }, [search, isContributorActive]);
};
