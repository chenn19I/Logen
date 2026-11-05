import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic tokens. Use these on every new surface.
        ink: {
          DEFAULT: "var(--bg)",
          deep: "var(--bg-deep)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
          sunken: "var(--surface-sunken)",
        },
        line: {
          DEFAULT: "var(--line)",
          strong: "var(--line-strong)",
        },
        paper: {
          DEFAULT: "var(--text)",
          dim: "var(--text-dim)",
          muted: "var(--muted)",
        },
        signal: {
          DEFAULT: "var(--accent)",
          strong: "var(--accent-strong)",
          soft: "var(--accent-soft)",
        },
        positive: {
          DEFAULT: "var(--positive)",
          soft: "var(--positive-soft)",
        },
        caution: {
          DEFAULT: "var(--caution)",
          soft: "var(--caution-soft)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          soft: "var(--danger-soft)",
        },

        // Compatibility aliases for the routes that are not part of the
        // redesign yet. They resolve to the same semantic palette.
        void: "var(--bg)",
        bento: "var(--surface)",
        radial: "var(--surface-raised)",
        obsidian: {
          950: "var(--bg-deep)",
          900: "var(--surface)",
          800: "var(--surface)",
          700: "var(--surface-raised)",
          600: "var(--line-strong)",
        },
        gold: {
          200: "var(--accent-strong)",
          300: "var(--accent)",
          400: "var(--accent)",
          500: "var(--accent)",
          600: "var(--accent-strong)",
          700: "var(--accent-strong)",
        },
        jade: {
          300: "var(--positive)",
          400: "var(--positive)",
          500: "var(--positive)",
          600: "var(--positive)",
        },
        segel: {
          400: "var(--positive)",
          500: "var(--positive)",
          600: "var(--positive)",
        },
        amber: {
          300: "var(--caution)",
          400: "var(--caution)",
          500: "var(--caution)",
        },
        threat: {
          400: "var(--danger)",
          500: "var(--danger)",
          600: "var(--danger)",
        },
      },
      fontFamily: {
        sans: ["var(--font-display)"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
        serif: ["var(--font-display)"],
      },
      maxWidth: {
        page: "1120px",
        prose: "680px",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sheet: "var(--radius)",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      letterSpacing: {
        label: "var(--tracking-label)",
        display: "var(--tracking-display)",
        relic: "var(--tracking-display)",
      },
      transitionTimingFunction: {
        calm: "var(--ease)",
      },
      transitionDuration: {
        120: "120ms",
        200: "200ms",
        320: "320ms",
      },
    },
  },
  plugins: [],
};

export default config;
