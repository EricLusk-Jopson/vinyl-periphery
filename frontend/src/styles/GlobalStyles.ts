import { createGlobalStyle } from "styled-components";
import { Theme } from "./theme";

export const GlobalStyles = createGlobalStyle<{ theme: Theme }>`
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
 
  :root {
    ${({ theme }) =>
      Object.entries(theme.cssVariables.dark)
        .map(([key, value]) => `${key}: ${value};`)
        .join("\n")}
  }
 
  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: ${({ theme }) => theme.typography.fontFamily.primary};
    background-color: ${({ theme }) => theme.colors.background.primary};
    color: ${({ theme }) => theme.colors.text.primary};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Ensure proper box sizing */
  *, *::before, *::after {
    box-sizing: border-box;
  }

  /* Improve default button styling */
  button {
    font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
    transition: all ${({ theme }) => theme.transitions.fast};
  }

  /* Smooth scrolling */
  html {
    scroll-behavior: smooth;
  }
`;
