import {
  SearchParams,
  SearchTarget,
  Contributor,
  EnrichedRelease,
  ContributorSet,
} from "../../api/types";
import type { SearchOrigin } from "@/lib/lineage";

export interface RequiredFilters {
  contributors: number[];
  roles: string[];
}

/** One search on the trail to another, as it was when the child ran. */
export interface LineageStep {
  searchId: string;
  /** e.g. "master:123"; empty for a search from before targets. */
  targetKey: string;
  title: string;
  artist: string;
  /** Whatever art URL was known at the time. */
  thumb: string;
  /** Contributor ids that linked this step to the previous one. Empty for the root. */
  via: number[];
}

/**
 * How a search was reached. Stored, never derived: deleting a search in the
 * middle of a trail changes nothing for the searches after it.
 */
export interface SearchLineage {
  /** The root search's id when the trail started. Never changes. */
  stackId: string;
  /** Steps from the root, as explored. 0 for a root. */
  depth: number;
  /** Root first, ending with this search's parent. Snapshots, not references. */
  path: LineageStep[];
  /** Contributor ids that linked this search to its parent. Empty for a root. */
  via: number[];
}

export interface SearchCache {
  searchId: string;
  /** What was typed or clicked, for display and URLs. */
  searchParams: SearchParams;
  /** Which Discogs album this is. Missing on searches from before ids. */
  target?: SearchTarget;
  /** How this search was reached. Missing on older searches: those are roots. */
  lineage?: SearchLineage;
  contributors: Record<number, Contributor>;
  roles: Record<string, boolean>;
  /** Keyed by `EnrichedRelease.key` ("master:N" / "release:N"). */
  releases: Record<string, EnrichedRelease>;
  filterState: {
    contributors: Record<number, boolean>;
    roles: Record<string, boolean>;
    excludeMainArtist: boolean;
    collaborationsOnly: boolean;
    excludeVarious: boolean;
    /**
     * Only albums the user has liked (likes live in localStorage, by result
     * key). Missing on searches from before it existed: off.
     */
    likedOnly?: boolean;
    /**
     * "Must include": every result has each of these contributors, and for
     * each role, a contributor who had it on the searched album. Missing on
     * searches saved before it existed.
     */
    required?: RequiredFilters;
  };
  thumb: string;
  savedAt?: number;
}

export interface SaveOptions {
  /**
   * "Save on its own", or take a saved search out of its stack: starts a
   * trail of its own (`detachedLineage`), so it never regroups.
   */
  withoutLineage?: boolean;
  /**
   * Joins another stack: saved with this lineage instead of its own, as if
   * searched from a member of that stack (see `stacksThisFits`).
   */
  lineage?: SearchLineage;
}

export interface CacheState {
  searches: Record<string, SearchCache>;
  activeSearchId: string | null;
  /**
   * Every search in the library. All searches are kept now; the name is
   * from when only some were.
   */
  savedSearchIds: Set<string>;
}

export interface CacheContextValue extends CacheState {
  /** The library has been read from IndexedDB. Not persisted. */
  savedSearchesLoaded: boolean;
  /** Old search id -> the repeat run that replaced it (in localStorage). */
  replacedBy: Record<string, string>;
  // Action methods
  setActiveSearch: (searchId: string) => void;
  clearActiveSearch: () => void;
  addSearch: (
    params: SearchParams,
    contributorSet: ContributorSet,
    releases: Record<string, EnrichedRelease>,
    thumb: string,
    target?: SearchTarget | null,
    origin?: SearchOrigin,
    /** Rejoins a known trail, e.g. searching a ghosted stack step again. */
    lineage?: SearchLineage
  ) => string;
  updateFilterState: (
    searchId: string,
    updates: Partial<SearchCache["filterState"]>
  ) => void;
  getActiveSearch: () => SearchCache | null;
  /** Deletes a search from the library. */
  deleteSearch: (searchId: string) => Promise<void>;
  /** Writes a search again, e.g. with new lineage (see SaveOptions). */
  saveSearch: (searchId: string, options?: SaveOptions) => Promise<void>;
  /** Every saved search in the stack back on its own. Returns how many. */
  disbandStack: (stackId: string) => Promise<number>;
  /** Puts a deleted search back (undo). */
  restoreSearch: (search: SearchCache) => Promise<void>;
}
