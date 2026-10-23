/** @type {import('tailwindcss').Config} */

// Design tokens live as CSS variables in src/styles/globals.css.
// See docs/redesign/tokens.md for what each one is for.
const token = (name) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1280px",
      },
    },
    extend: {
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        faint: token("faint"),
        surface: token("surface"),
        card: {
          DEFAULT: token("card"),
          foreground: token("card-foreground"),
        },
        popover: {
          DEFAULT: token("popover"),
          foreground: token("popover-foreground"),
        },
        primary: {
          DEFAULT: token("primary"),
          foreground: token("primary-foreground"),
          text: token("primary-text"),
          // Legacy aliases, removed once every component is rebuilt.
          main: token("primary"),
          dark: token("primary-dark"),
          light: token("primary-text"),
        },
        secondary: {
          DEFAULT: token("secondary"),
          foreground: token("secondary-foreground"),
        },
        muted: {
          DEFAULT: token("muted"),
          foreground: token("muted-foreground"),
        },
        accent: {
          DEFAULT: token("accent"),
          foreground: token("accent-foreground"),
        },
        destructive: {
          DEFAULT: token("destructive"),
          foreground: token("destructive-foreground"),
        },
        border: {
          DEFAULT: token("border"),
          strong: token("border-strong"),
          emphasis: token("border-emphasis"),
        },
        input: token("input"),
        ring: token("ring"),

        // Legacy names used by components not yet rebuilt. Do not use in new code.
        text: {
          primary: token("foreground"),
          secondary: token("muted-foreground"),
          disabled: token("faint"),
          inverse: token("background"),
        },
        bg: {
          primary: token("background"),
          secondary: token("surface"),
          tertiary: token("secondary"),
        },
      },
      fontFamily: {
        display: ["'Bebas Neue'", "Impact", "'Arial Narrow Bold'", "sans-serif"],
        sans: ["'IBM Plex Sans'", "system-ui", "-apple-system", "'Segoe UI'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        // Legacy aliases.
        primary: ["'Bebas Neue'", "Impact", "'Arial Narrow Bold'", "sans-serif"],
        secondary: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      zIndex: {
        header: "700",
        overlay: "900",
        modal: "1000",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
