import React from "react";
import "./styles/globals.css";
import { SearchForm } from "./components/searchForm/SearchForm";
import {
  useDiscogsSearch,
  useListReleaseContributors,
  useListContributorReleases,
} from "./api/mutations";
import { EnrichedRelease, SearchParams } from "./api/types";
import { useCache, CacheProvider } from "./contexts/cache/CacheContext";
import { Header } from "./components/layout/Header";
import { ReleaseList } from "./components/resultsDisplay/ReleaseList";

// Separate component to handle search logic
const SearchContainer: React.FC = () => {
  const { addSearch, getActiveSearch } = useCache();

  const searchMutation = useDiscogsSearch();
  const contributorsMutation = useListReleaseContributors();
  const releasesMutation = useListContributorReleases();

  const isSearching =
    searchMutation.isPending ||
    contributorsMutation.isPending ||
    releasesMutation.isPending;

  const handleSearch = async (params: SearchParams) => {
    try {
      // Initial search
      const searchResults = await searchMutation.mutateAsync(params);
      if (!searchResults) return;

      // Get contributors
      const contributorSet = await contributorsMutation.mutateAsync({
        releases: searchResults,
        maxReleases: 5,
      });

      // Get releases
      const releasesMap = await releasesMutation.mutateAsync({
        contributorSet,
      });

      // Convert Map to Record before adding to cache
      const releasesRecord = Object.fromEntries(
        Array.from(releasesMap.entries()).map(([id, release]) => [
          id,
          {
            ...release,
            contributorIds: Array.from(release.contributorIds),
          },
        ])
      ) as Record<number, EnrichedRelease>;

      // Add to cache
      addSearch(params, contributorSet, releasesRecord);
    } catch (error) {
      console.error("Search chain error:", error);
    }
  };

  const activeSearch = getActiveSearch();

  return (
    <main className="flex-1 container mx-auto px-4 py-8">
      <SearchForm onSearch={handleSearch} isSearching={isSearching} />
      {activeSearch && <ReleaseList searchId={activeSearch.searchId} />}
    </main>
  );
};

const App: React.FC = () => {
  return (
    <CacheProvider>
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <SearchContainer />
      </div>
    </CacheProvider>
  );
};

export default App;
