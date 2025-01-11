export const theme = {
  colors: {
    primary: {
      main: "#CA231F",
      dark: "#851714",
    },
    text: {
      primary: "#fff",
      secondary: "#ccc",
      disabled: "gray",
    },
    background: {
      primary: "#000000",
      secondary: "#111111",
    },
  },
  typography: {
    fontFamily: {
      primary: '"Bebas Neue", sans-serif',
      secondary: "Monda, sans-serif",
    },
    fontSize: {
      sm: "1em",
      md: "1.2rem",
      lg: "1.5rem",
      xl: "1.8em",
    },
    letterSpacing: {
      normal: "3px",
      wide: "4px",
    },
  },
  spacing: {
    xxs: "5px",
    xs: "7px",
    sm: "10px",
    md: "15px",
    lg: "20px",
    xl: "50px",
    xxl: "75px",
  },
  breakpoints: {
    sm: "400px",
    md: "700px",
    lg: "1200px",
  },
} as const;

export type Theme = typeof theme;
