import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const brandBasePlugin = plugin(({ addBase }) => {
  addBase({
    body: {
      color: "#000000",
      backgroundColor: "#FFFFFF",
    },
    main: {
      backgroundColor: "#FFFFFF",
    },
    "h1, h2, h3, h4, h5, h6": {
      color: "#3C6C25",
    },
  });
});

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/auth-ui/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/branding/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        brand: {
          green: "#3C6C25",
          gold: "#B68035",
          black: "#000000",
          white: "#FFFFFF",
        },
      },
      keyframes: {
        pulseBrandGold: {
          "0%, 100%": {
            boxShadow: "0 0 0 0 rgba(182, 128, 53, 0.85)",
          },
          "55%": {
            boxShadow: "0 0 0 14px rgba(182, 128, 53, 0)",
          },
        },
      },
      animation: {
        "pulse-brand-gold": "pulseBrandGold 2.2s ease-out infinite",
      },
    },
  },
  plugins: [brandBasePlugin],
};

export default config;
