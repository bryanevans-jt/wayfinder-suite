import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/auth-ui/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/branding/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#3C6C25",
          gold: "#B68035",
          black: "#152018",
          white: "#FFFFFF",
          sky: "#7EB6C9",
          sand: "#D8C7A8",
        },
      },
      fontFamily: {
        display: ["var(--font-rv-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-rv-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
