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
        void: "#06080D",
        bento: "#0B0F1A",
        radial: "#0D1526",
        jade: {
          300: "#5CFFB8",
          400: "#00EC97",
          500: "#00EC97",
          600: "#00BA77",
        },
        // Harmonized aliases so every route shares the Tactile Cryptographic Relic palette
        obsidian: {
          950: "#06080D",
          900: "#0B0F1A",
          800: "#0D1526",
          700: "#131E35",
          600: "#1C2B4B",
        },
        gold: {
          200: "#A7FFDE",
          300: "#5CFFB8",
          400: "#00EC97",
          500: "#00EC97",
          600: "#00C47D",
          700: "#008F5B",
        },
        segel: {
          400: "#10B981",
          500: "#10B981",
          600: "#059669",
        },
        amber: {
          300: "#FCD34D",
          400: "#FBBF24",
          500: "#F59E0B",
        },
        threat: {
          400: "#F87171",
          500: "#EF4444",
          600: "#DC2626",
        },
      },
      fontFamily: {
        // Tactile Cryptographic Relic: Plus Jakarta Sans / Inter for all UI & display headings
        serif: ["var(--font-jakarta)", "Inter", "system-ui", "sans-serif"],
        sans: ["var(--font-jakarta)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "JetBrains Mono", "monospace"],
      },
      letterSpacing: {
        relic: "-0.03em",
      },
      backgroundImage: {
        "kraton-radial":
          "radial-gradient(ellipse 80% 50% at 50% -10%, #0D1526 0%, rgba(13, 21, 38, 0.55) 45%, #06080D 100%)",
        "relic-radial":
          "radial-gradient(ellipse 80% 50% at 50% -10%, #0D1526 0%, rgba(11, 15, 26, 0.7) 50%, #06080D 100%)",
      },
      boxShadow: {
        jade: "0 0 28px rgba(0, 236, 151, 0.25)",
        "jade-sm": "0 0 16px rgba(0, 236, 151, 0.18)",
        frozen: "0 0 28px rgba(245, 158, 11, 0.18)",
        blocked: "0 0 28px rgba(239, 68, 68, 0.22)",
      },
    },
  },
  plugins: [],
};

export default config;
