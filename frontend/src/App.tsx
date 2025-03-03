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
import ColorExtractor from "./components/layout/ColorExtractor";
import { Color, extractColorPalette } from "./lib/colors/paletteExtractor";

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
      const thumb = searchResults[0]?.thumb ?? searchResults[0]?.cover_image;
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
      const searchId = addSearch(params, contributorSet, releasesRecord);
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

const extractPaletteWithDelay = (imageUrl, delay) => {
  return new Promise<Color[]>((resolve) => {
    setTimeout(() => {
      extractColorPalette(imageUrl).then((result) => resolve(result));
    }, delay);
  });
};

const App: React.FC = () => {
  const [colorPalette, setColorPalette] = useState<Color[]>();

  useEffect(() => {
    const getPalette = async () => {
      const palette = await extractPaletteWithDelay(
        "https://i.discogs.com/Ft21hD1op7eJI1gBZdACEZDwhazLqDexmL--rz--kkc/rs:fit/g:sm/q:40/h:150/w:150/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTMwODkx/MTQ0LTE3MjcwNjgz/ODctMzU4OS5qcGVn.jpeg",
        3000
      );
      console.log(palette);
      setColorPalette(palette);
    };

    getPalette();
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Static background */}
      <TVStaticEffect
        scaleFactor={2.5}
        sampleCount={36}
        fps={13}
        colorIntensity={0.005}
        colorPalette={colorPalette}
      />

      {/* Content overlay */}
      <div className="flex flex-col min-h-screen relative z-10">
        <Header />
        <ColorExtractor externalUrl="https://i.discogs.com/Ft21hD1op7eJI1gBZdACEZDwhazLqDexmL--rz--kkc/rs:fit/g:sm/q:40/h:150/w:150/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTMwODkx/MTQ0LTE3MjcwNjgz/ODctMzU4OS5qcGVn.jpeg" />
        <SearchContainer />
        <Footer />
      </div>
    </div>
  );
};

export default App;
