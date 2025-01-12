import {
  SearchParams,
  Contributor,
  EnrichedRelease,
  ContributorSet,
} from "../../api/types";

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
  };
  savedAt?: number;
}

export interface CacheState {
  searches: Record<string, SearchCache>;
  activeSearchId: string | null;
  savedSearchIds: Set<string>;
}

export interface CacheContextValue extends CacheState {
  // Action methods
  setActiveSearch: (searchId: string) => void;
  addSearch: (
    params: SearchParams,
    contributorSet: ContributorSet,
    releases: Record<number, EnrichedRelease>
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
