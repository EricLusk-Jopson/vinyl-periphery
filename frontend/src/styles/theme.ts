export const theme = {
  colors: {
    primary: {
      main: "#CA231F",
      dark: "#851714",
      light: "#E84A45", // Added for hover states
    },
    text: {
      primary: "#fff",
      secondary: "#ccc",
      disabled: "gray",
      inverse: "#000", // Added for light backgrounds
    },
    background: {
      primary: "#000000",
      secondary: "#111111",
      tertiary: "#222222", // Added for layering
    },
    border: {
      primary: "#CA231F",
      secondary: "#333333",
    },
    status: {
      success: "#4CAF50",
      error: "#f44336",
      warning: "#ff9800",
      info: "#2196f3",
    },
  },
  typography: {
    fontFamily: {
      primary: '"Bebas Neue", sans-serif',
      secondary: "Monda, sans-serif",
    },
    fontSize: {
      xs: "0.875rem", // 14px
      sm: "1rem", // 16px
      md: "1.2rem", // 19.2px
      lg: "1.5rem", // 24px
      xl: "1.8rem", // 28.8px
      xxl: "2.25rem", // 36px
    },
    letterSpacing: {
      normal: "3px",
      wide: "4px",
      tight: "1px", // Added for denser text
    },
    lineHeight: {
      tight: "1.2",
      normal: "1.5",
      loose: "1.8",
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
    xs: "320px",
    sm: "400px",
    md: "700px",
    lg: "1200px",
    xl: "1440px",
  },
  borderRadius: {
    none: "0",
    sm: "4px",
    md: "8px",
    lg: "12px",
    pill: "9999px",
  },
  shadows: {
    sm: "0 1px 3px rgba(0, 0, 0, 0.12)",
    md: "0 4px 6px rgba(0, 0, 0, 0.1)",
    lg: "0 10px 15px rgba(0, 0, 0, 0.1)",
  },
  transitions: {
    fast: "150ms ease",
    normal: "300ms ease",
    slow: "500ms ease",
  },
  zIndex: {
    modal: 1000,
    overlay: 900,
    dropdown: 800,
    header: 700,
    footer: 600,
  },
  // CSS Variables for shadcn integration
  cssVariables: {
    light: {
      "--background": "0 0% 100%",
      "--foreground": "0 0% 0%",
      "--primary": "0 72.2% 50.6%", // Your red color
      "--primary-foreground": "0 85.7% 97.3%",
      "--secondary": "0 0% 96.1%",
      "--secondary-foreground": "0 0% 9%",
      "--muted": "0 0% 96.1%",
      "--muted-foreground": "0 0% 45.1%",
      "--accent": "0 0% 96.1%",
      "--accent-foreground": "0 0% 9%",
      "--destructive": "0 84.2% 60.2%",
      "--destructive-foreground": "0 0% 98%",
      "--border": "0 0% 89.8%",
      "--input": "0 0% 89.8%",
      "--ring": "0 72.2% 50.6%", // Your red color
      "--radius": "0.5rem",
    },
    dark: {
      "--background": "0 0% 0%", // Your black
      "--foreground": "0 0% 100%", // White
      "--primary": "0 72.2% 50.6%", // Your red color
      "--primary-foreground": "0 85.7% 97.3%",
      "--secondary": "0 0% 6.7%", // Your secondary background
      "--secondary-foreground": "0 0% 100%",
      "--muted": "0 0% 6.7%",
      "--muted-foreground": "0 0% 80%",
      "--accent": "0 0% 6.7%",
      "--accent-foreground": "0 0% 100%",
      "--destructive": "0 62.8% 30.6%",
      "--destructive-foreground": "0 0% 100%",
      "--border": "0 72.2% 50.6%", // Your red color
      "--input": "0 0% 6.7%",
      "--ring": "0 72.2% 50.6%", // Your red color
      "--radius": "0.5rem",
    },
  },
} as const;

export type Theme = typeof theme;
