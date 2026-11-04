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
        obsidian: {
          950: "#06070E",
          900: "#090B14",
          800: "#101424",
          700: "#181E36",
          600: "#232B4A",
        },
        gold: {
          300: "#F8DF95",
          400: "#F3C969",
          500: "#D4A64A",
          600: "#A87E2B",
          700: "#785716",
        },
        segel: {
          400: "#34D399",
          500: "#10B981",
          600: "#059669",
        },
        threat: {
          400: "#FB7185",
          500: "#F43F5E",
          600: "#E11D48",
        },
      },
      fontFamily: {
        serif: ["var(--font-cormorant)", "Georgia", "serif"],
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      backgroundImage: {
        "kraton-radial":
          "radial-gradient(circle at 50% 0%, rgba(212, 166, 74, 0.14) 0%, rgba(16, 20, 36, 0.6) 45%, rgba(9, 11, 20, 1) 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
