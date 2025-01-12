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
}

export interface CacheState {
  searches: Record<string, SearchCache>;
  activeSearchId: string | null;
}

export interface CacheContextValue {
  searches: Record<string, SearchCache>; // Changed from Map to Record
  activeSearchId: string | null;
  setActiveSearch: (searchId: string) => void;
  addSearch: (
    params: SearchParams,
    contributorSet: ContributorSet,
    releases: Record<number, EnrichedRelease>
  ) => string; // Note: returns the searchId
  updateFilterState: (
    searchId: string,
    updates: Partial<SearchCache["filterState"]>
  ) => void;
  getActiveSearch: () => SearchCache | null;
  clearSearch: (searchId: string) => void;
  clearAllSearches: () => void;
}
