// src/App.tsx
import { ThemeProvider } from "styled-components";
import { GlobalStyles } from "./styles/GlobalStyles";
import { theme } from "./styles/theme";
import { SearchForm } from "./components/search/SearchForm";
import styled from "styled-components";

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

function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles theme={theme} />
      <AppContainer>
        <Header>
          <Title>Vinyl Periphery</Title>
        </Header>
        <main>
          <SearchForm />
        </main>
      </AppContainer>
    </ThemeProvider>
  );
}

export default App;
