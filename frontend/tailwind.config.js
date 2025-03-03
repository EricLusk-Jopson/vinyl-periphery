/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        xs: "320px",
        sm: "400px",
        md: "700px",
        lg: "1200px",
        xl: "1440px",
      },
    },
    extend: {
      colors: {
        // Main theme colors
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          main: "#D9325E",
          dark: "#252759",
          light: "#C2BBF2",
        },
        text: {
          primary: "#eee",
          secondary: "#fff",
          disabled: "gray",
          inverse: "#000000",
        },
        bg: {
          primary: "#010D00",
          secondary: "#222126",
          tertiary: "#222222",
        },
        status: {
          success: "#4CAF50",
          error: "#f44336",
          warning: "#ff9800",
          info: "#2196f3",
        },
        // shadcn required colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        primary: ["Bebas Neue", "Impact", "Arial Narrow Bold", "sans-serif"],
        secondary: [
          "Monda",
          "Segoe UI",
          "Tahoma",
          "Geneva",
          "Verdana",
          "sans-serif",
        ],
      },
      fontSize: {
        xs: "0.6rem",
        sm: "1rem",
        md: "1.2rem",
        lg: "1.5rem",
        xl: "1.8rem",
        "2xl": "2.25rem",
      },
      letterSpacing: {
        tight: "1px",
        normal: "3px",
        wide: "4px",
      },
      lineHeight: {
        tight: "1.2",
        normal: "1.5",
        loose: "1.8",
      },
      spacing: {
        xxs: "5px",
        xs: "7px",
        sm: "10px",
        md: "15px",
        lg: "20px",
        xl: "50px",
        "2xl": "75px",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        none: "0",
        pill: "9999px",
      },
      boxShadow: {
        sm: "0 1px 3px rgba(0, 0, 0, 0.12)",
        md: "0 4px 6px rgba(0, 0, 0, 0.1)",
        lg: "0 10px 15px rgba(0, 0, 0, 0.1)",
      },
      transitionDuration: {
        fast: "150ms",
        normal: "300ms",
        slow: "500ms",
      },
      transitionTimingFunction: {
        DEFAULT: "ease",
      },
      zIndex: {
        modal: 1000,
        overlay: 900,
        dropdown: 800,
        header: 700,
        footer: 600,
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
