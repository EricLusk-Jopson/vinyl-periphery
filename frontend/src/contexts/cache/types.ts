import {
  SearchParams,
  Contributor,
  EnrichedRelease,
  ContributorSet,
} from "../../api/types";

export interface RequiredFilters {
  contributors: number[];
  roles: string[];
}

export interface SearchCache {
  searchId: string;
  searchParams: SearchParams;
  contributors: Record<number, Contributor>;
  roles: Record<string, boolean>;
  releases: Record<number, EnrichedRelease>;
  filterState: {
    contributors: Record<number, boolean>;
    roles: Record<string, boolean>;
    excludeMainArtist: boolean;
    collaborationsOnly: boolean;
    excludeVarious: boolean;
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

export interface CacheState {
  searches: Record<string, SearchCache>;
  activeSearchId: string | null;
  savedSearchIds: Set<string>;
}

export interface CacheContextValue extends CacheState {
  /** Saved searches have been read from IndexedDB. Not persisted. */
  savedSearchesLoaded: boolean;
  /** Old search id -> the repeat run that replaced it (in localStorage). */
  replacedBy: Record<string, string>;
  // Action methods
  setActiveSearch: (searchId: string) => void;
  clearActiveSearch: () => void;
  addSearch: (
    params: SearchParams,
    contributorSet: ContributorSet,
    releases: Record<number, EnrichedRelease>,
    thumb: string
  ) => string;
  updateFilterState: (
    searchId: string,
    updates: Partial<SearchCache["filterState"]>
  ) => void;
  getActiveSearch: () => SearchCache | null;
  clearSearch: (searchId: string) => void;
  clearSessionHistory: () => void;
  clearSavedSearches: () => void;
  saveSearch: (searchId: string) => Promise<void>;
  unsaveSearch: (searchId: string) => Promise<void>;
  isSearchSaved: (searchId: string) => boolean;
}
