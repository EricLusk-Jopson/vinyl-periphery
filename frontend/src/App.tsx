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
import styled from "styled-components";
import { EnrichedRelease, SearchParams } from "./api/types";
import { useCache, CacheProvider } from "./contexts/cache/CacheContext";
import { ResultsDisplay } from "./components/resultsDisplay/ResultsDisplay";

const AppContainer = styled.div`
  min-height: 100vh;
  background-color: ${({ theme }) => theme.colors.background.primary};
`;

const Header = styled.header`
  padding: ${({ theme }) => theme.spacing.lg};
  text-align: center;
`;

const Title = styled.h1`
  color: ${({ theme }) => theme.colors.primary.main};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.wide};
`;

const MainContent = styled.main`
  width: 100%;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg};
  gap: ${({ theme }) => theme.spacing.xl};
  display: flex;
  flex-direction: column;
  align-items: center;
`;

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
          <Header>
            <Title>Vinyl Periphery</Title>
          </Header>
          <SearchContainer />
        </AppContainer>
      </CacheProvider>
    </ThemeProvider>
  );
};

export default App;
