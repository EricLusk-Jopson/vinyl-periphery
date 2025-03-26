import React, { useCallback, useEffect, useState } from "react";
import "./styles/globals.css";
import { SearchForm } from "./components/searchForm/SearchForm";
import {
  useDiscogsSearch,
  useListReleaseContributors,
  useListContributorReleases,
} from "./api/mutations";
import { EnrichedRelease, SearchParams, SearchStage } from "./api/types";
import { useCache } from "./contexts/cache/CacheContext";
import { Header } from "./components/layout/Header";
import { ReleaseList } from "./components/resultsDisplay/ReleaseList";
import { ToastAction } from "./components/ui/toast";
import { useToast } from "./hooks/use-toast";
import { Footer } from "./components/layout/Footer";
import TVStaticEffect from "./components/layout/TVStaticEffect";
import { Color, extractColorPalette } from "./lib/colors/paletteExtractor";
import { Button } from "./components/ui/button"; // Import Button component
import { Pause, Play } from "lucide-react"; // Import icons

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
      const thumb =
        searchResults[0]?.thumb ?? searchResults[0]?.cover_image ?? "";
      console.log(thumb);

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
      console.log(releasesRecord);

      // Add to cache without making it active
      const searchId = addSearch(params, contributorSet, releasesRecord, thumb);
      const activeSearch = getActiveSearch();
      if (!activeSearch) {
        setActiveSearch(searchId);
      }

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
    <main className="flex-1 container mx-auto px-4 py-8 relative z-10">
      <SearchForm onSearch={handleSearch} isSearching={isSearching} />
      {activeSearch && <ReleaseList searchId={activeSearch.searchId} />}
    </main>
  );
};

const App: React.FC = () => {
  const [colorPalette, setColorPalette] = useState<Color[]>();
  const [isStaticPaused, setIsStaticPaused] = useState(false);
  const { getActiveSearch } = useCache();
  const activeSearch = getActiveSearch();

  useEffect(() => {
    if (!activeSearch) return;

    const getPalette = async () => {
      if (!activeSearch.thumb) return;
      const palette = await extractColorPalette(activeSearch.thumb);
      setColorPalette(palette);
    };

    getPalette();
  }, [activeSearch]);

  const toggleStatic = () => {
    setIsStaticPaused((prev) => !prev);
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Static background */}
      <TVStaticEffect
        scaleFactor={2.5}
        sampleCount={36}
        fps={8}
        colorIntensity={0.002}
        colorPalette={colorPalette}
        paused={isStaticPaused}
      />

      {/* Content overlay */}
      <div className="flex flex-col min-h-screen relative z-10">
        <Header />
        <SearchContainer />
        <Footer />
      </div>

      {/* Static toggle button */}
      <div className="fixed bottom-4 right-2 z-50">
        <Button
          onClick={toggleStatic}
          variant="secondary"
          size="icon"
          className="rounded-full shadow-md bg-black/30 backdrop-blur-sm"
          aria-label={
            isStaticPaused
              ? "Enable background animation"
              : "Pause background animation"
          }
        >
          {isStaticPaused ? <Play size={16} /> : <Pause size={16} />}
        </Button>
      </div>
    </div>
  );
};

export default App;
