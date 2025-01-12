import React, { useCallback } from "react";
import "./styles/globals.css";
import { SearchForm } from "./components/searchForm/SearchForm";
import {
  useDiscogsSearch,
  useListReleaseContributors,
  useListContributorReleases,
} from "./api/mutations";
import { EnrichedRelease, SearchParams, SearchStage } from "./api/types";
import { useCache, CacheProvider } from "./contexts/cache/CacheContext";
import { Header } from "./components/layout/Header";
import { ReleaseList } from "./components/resultsDisplay/ReleaseList";
import { ToastAction } from "./components/ui/toast";
import { useToast } from "./hooks/use-toast";

const SearchContainer: React.FC = () => {
  const { addSearch, getActiveSearch, setActiveSearch } = useCache();
  const { toast } = useToast();

  const searchMutation = useDiscogsSearch();
  const contributorsMutation = useListReleaseContributors();
  const releasesMutation = useListContributorReleases();

  const isSearching =
    searchMutation.isPending ||
    contributorsMutation.isPending ||
    releasesMutation.isPending;

  const handleViewResults = useCallback(
    (searchId: string) => {
      // Set this search as active in the cache
      setActiveSearch(searchId);

      // Scroll to results section smoothly
      const resultsSection = document.getElementById("search-results");
      if (resultsSection) {
        resultsSection.scrollIntoView({ behavior: "smooth" });
      } else {
        // Fallback if results section isn't found
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [setActiveSearch]
  );

  const handleSearch = async (
    params: SearchParams,
    onProgress?: (stage: SearchStage) => void
  ) => {
    try {
      // Initial search
      const searchResults = await searchMutation.mutateAsync({
        params,
        callbacks: {
          onProgress,
        },
      });

      if (!searchResults) return;

      // Get contributors
      const contributorSet = await contributorsMutation.mutateAsync({
        releases: searchResults,
        maxReleases: 5,
        callbacks: {
          onProgress,
        },
      });

      // Get releases
      const releasesMap = await releasesMutation.mutateAsync({
        contributorSet,
        callbacks: {
          onProgress,
        },
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

      // Add to cache without making it active
      const searchId = addSearch(params, contributorSet, releasesRecord);

      // Show completion toast
      toast({
        title: "Search Complete",
        description: `Results ready for ${params.artist} - ${params.album}`,
        action: (
          <ToastAction
            altText="View results"
            onClick={() => handleViewResults(searchId)}
          >
            View Results
          </ToastAction>
        ),
      });
    } catch (error) {
      console.error("Search chain error:", error);
      toast({
        title: "Search Error",
        description: "An error occurred while searching. Please try again.",
        variant: "destructive",
      });
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
