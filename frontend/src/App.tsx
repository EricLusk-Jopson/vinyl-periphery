import React from "react";
import { ThemeProvider } from "styled-components";
import { GlobalStyles } from "./styles/GlobalStyles";
import { theme } from "./styles/theme";
import { SearchForm } from "./components/searchForm/SearchForm";
import {
  useDiscogsSearch,
  useListReleaseContributors,
  useListContributorReleases,
} from "./api/mutations";
import { EnrichedRelease, SearchParams } from "./api/types";
import { useCache, CacheProvider } from "./contexts/cache/CacheContext";
import { ResultsDisplay } from "./components/resultsDisplay/ResultsDisplay";
import { AppContainer, MainContent } from "./components/layout/styles";
import { Header } from "./components/layout/Header";

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
            contributorIds: Array.from(release.contributorIds), // Also convert Set to array
          },
        ])
      ) as Record<number, EnrichedRelease>;

      console.log(searchResults, contributorSet, releasesMap, releasesRecord);

      // Add to cache
      addSearch(params, contributorSet, releasesRecord);
    } catch (error) {
      console.error("Search chain error:", error);
    }
  };

  const activeSearch = getActiveSearch();

  return (
    <MainContent>
      <SearchForm onSearch={handleSearch} isSearching={isSearching} />
      {activeSearch && <ResultsDisplay searchId={activeSearch.searchId} />}
    </MainContent>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles theme={theme} />
      <CacheProvider>
        <AppContainer>
          <Header />
          <MainContent>
            <SearchContainer />
          </MainContent>
        </AppContainer>
      </CacheProvider>
    </ThemeProvider>
  );
};

export default App;
