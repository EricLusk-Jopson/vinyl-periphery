import React, { useCallback, useEffect, useState } from "react";
import "./styles/globals.css";
import {
  useDiscogsSearch,
  useListReleaseContributors,
  useListContributorReleases,
} from "./api/mutations";
import { EnrichedRelease, SearchParams, SearchStage } from "./api/types";
import { useCache } from "./contexts/cache/CacheContext";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { Home } from "./components/home/Home";
import { SearchForm } from "./components/search/SearchForm";
import { ReleaseList } from "./components/resultsDisplay/ReleaseList";
import { useToast } from "./hooks/use-toast";

const EMPTY_SEARCH: SearchParams = { artist: "", album: "" };

const App: React.FC = () => {
  const { addSearch, getActiveSearch, setActiveSearch, clearActiveSearch } =
    useCache();
  const { toast } = useToast();

  const searchMutation = useDiscogsSearch();
  const contributorsMutation = useListReleaseContributors();
  const releasesMutation = useListContributorReleases();

  const isSearching =
    searchMutation.isPending ||
    contributorsMutation.isPending ||
    releasesMutation.isPending;

  const activeSearch = getActiveSearch();

  // One set of form values, shared by the hero and the compact header form
  // (only one is on screen at a time).
  const [formValues, setFormValues] = useState<SearchParams>(
    () => activeSearch?.searchParams ?? EMPTY_SEARCH
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [focusHeroSearch, setFocusHeroSearch] = useState(false);

  // Show the open search in the compact form, including one picked from
  // history. searchParams keeps its identity across filter changes.
  const activeParams = activeSearch?.searchParams;
  useEffect(() => {
    if (activeParams) setFormValues(activeParams);
  }, [activeParams]);

  const goHome = useCallback(() => {
    clearActiveSearch();
    setFormValues(EMPTY_SEARCH);
    setFocusHeroSearch(true);
    window.scrollTo({ top: 0 });
  }, [clearActiveSearch]);

  const openSearch = useCallback(
    (searchId: string) => {
      setActiveSearch(searchId);
      window.scrollTo({ top: 0 });
    },
    [setActiveSearch]
  );

  const handleSearch = async (
    params: SearchParams,
    onProgress?: (stage: SearchStage) => void
  ) => {
    try {
      const searchResults = await searchMutation.mutateAsync({
        params,
        callbacks: { onProgress },
      });

      if (!searchResults) return;
      const thumb =
        searchResults[0]?.thumb ?? searchResults[0]?.cover_image ?? "";

      const contributorSet = await contributorsMutation.mutateAsync({
        releases: searchResults,
        maxReleases: 5,
        callbacks: { onProgress },
      });

      const releasesMap = await releasesMutation.mutateAsync({
        contributorSet,
        callbacks: { onProgress },
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

      const searchId = addSearch(params, contributorSet, releasesRecord, thumb);
      openSearch(searchId);
    } catch (error) {
      console.error("Search chain error:", error);
      toast({
        title: "Search failed",
        description: "Something went wrong talking to Discogs. Try again.",
        variant: "destructive",
      });
    }
  };

  const formProps = {
    values: formValues,
    onValuesChange: setFormValues,
    onSearch: handleSearch,
    isSearching,
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header
        historyOpen={historyOpen}
        onHistoryOpenChange={setHistoryOpen}
        onHome={goHome}
        search={<SearchForm variant="compact" {...formProps} />}
      />
      <main className="flex-1">
        {activeSearch ? (
          <div className="mx-auto max-w-[1280px] px-4 py-8 md:px-6">
            <ReleaseList searchId={activeSearch.searchId} />
          </div>
        ) : (
          <Home
            form={{ ...formProps, autoFocus: focusHeroSearch }}
            onOpenSearch={openSearch}
            onViewHistory={() => setHistoryOpen(true)}
          />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default App;
