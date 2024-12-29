import { createGlobalStyle } from "styled-components";
import { Theme } from "./theme";

export const GlobalStyles = createGlobalStyle<{ theme: Theme }>`
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Monda:wght@400;700&display=swap');

  *, *::before, *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    background-color: ${({ theme }) => theme.colors.background.primary};
    color: ${({ theme }) => theme.colors.text.primary};
    font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
    letter-spacing: ${({ theme }) => theme.typography.letterSpacing.normal};
    line-height: 1.5;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: ${({ theme }) => theme.typography.fontFamily.primary};
    letter-spacing: ${({ theme }) => theme.typography.letterSpacing.wide};
    margin-bottom: ${({ theme }) => theme.spacing.md};
  }

  h1 { font-size: ${({ theme }) => theme.typography.fontSize.xl}; }
  h2 { font-size: ${({ theme }) => theme.typography.fontSize.lg}; }
  h3 { font-size: ${({ theme }) => theme.typography.fontSize.md}; }
  h4, h5, h6 { font-size: ${({ theme }) => theme.typography.fontSize.sm}; }
`;
