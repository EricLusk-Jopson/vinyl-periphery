import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  Contributor,
  ContributorSet,
  SearchParams,
  EnrichedRelease,
} from "../../api/types";
import { CacheContextValue, CacheState, SearchCache } from "./types";
import { calculateReleaseScore } from "@/api/contributorSet";

const CacheContext = createContext<CacheContextValue | null>(null);

const STORAGE_KEY = "vinyl-periphery-cache";

export const CacheProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Initialize state from session storage or with defaults
  const [state, setState] = React.useState<CacheState>(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse stored cache:", e);
      }
    }
    return {
      searches: {},
      activeSearchId: null,
    };
  });

  // Sync to session storage whenever state changes
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setActiveSearch = useCallback((searchId: string) => {
    setState((prev) => ({
      ...prev,
      activeSearchId: searchId,
    }));
  }, []);

  const addSearch = useCallback(
    (
      params: SearchParams,
      contributorSet: ContributorSet,
      releases: Record<number, EnrichedRelease>
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
      };

      setState((prev) => ({
        searches: {
          ...prev.searches,
          [searchId]: {
            searchId,
            searchParams: params,
            contributors,
            roles,
            releases,
            filterState,
          },
        },
        activeSearchId: searchId,
      }));

      return searchId;
    },
    []
  );

  const updateFilterState = useCallback(
    (searchId: string, updates: Partial<SearchCache["filterState"]>) => {
      setState((prev) => ({
        ...prev,
        searches: {
          ...prev.searches,
          [searchId]: {
            ...prev.searches[searchId],
            filterState: {
              ...prev.searches[searchId].filterState,
              ...updates,
            },
          },
        },
      }));
    },
    []
  );

  const getActiveSearch = useCallback((): SearchCache | null => {
    if (!state.activeSearchId) return null;
    return state.searches[state.activeSearchId] || null;
  }, [state.activeSearchId, state.searches]);

  const clearSearch = useCallback((searchId: string) => {
    setState((prev) => {
      const { ...remaining } = prev.searches;
      delete remaining[searchId];
      return {
        searches: remaining,
        activeSearchId:
          prev.activeSearchId === searchId ? null : prev.activeSearchId,
      };
    });
  }, []);

  const clearAllSearches = useCallback(() => {
    setState({
      searches: {},
      activeSearchId: null,
    });
  }, []);

  const value: CacheContextValue = {
    ...state,
    setActiveSearch,
    addSearch,
    updateFilterState,
    getActiveSearch,
    clearSearch,
    clearAllSearches,
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

  // In useSearchFilters hook
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

      const isContributorIncluded =
        search.filterState.contributors[contributorId];
      if (!isContributorIncluded) return false;

      const contributor = search.contributors[contributorId];
      if (!contributor) return false;

      // Check if any of the contributor's roles are active
      return contributor.roles.some((role) => search.filterState.roles[role]);
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

      // A contributor is disabled only if all their roles are inactive
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
    filterState: search?.filterState,
  };
};

// Custom hook for filtered results
export const useFilteredAndScoredReleases = (searchId: string) => {
  const { searches } = useCache();
  const { isContributorActive } = useSearchFilters(searchId);
  const search = searches[searchId];

  return useMemo(() => {
    if (!search)
      return {
        releases: [],
        count: 0,
      };

    const processedReleases = Object.values(search.releases)
      .map((release) => {
        // Deduplicate contributor IDs once
        const uniqueContributorIds = Array.from(
          new Set(release.contributorIds)
        );

        // Check if this release should be included
        const hasActiveContributor = uniqueContributorIds.some((id) =>
          isContributorActive(id)
        );

        if (!hasActiveContributor) return null;

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
          activeContributors: uniqueContributorIds.filter((id) =>
            isContributorActive(id)
          ),
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
