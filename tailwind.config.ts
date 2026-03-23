import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Midnight & Gold palette
        forest: {
          50: "#f0f2f7",
          100: "#dde1ed",
          200: "#b8c0d9",
          300: "#8a96be",
          400: "#5d6da3",
          500: "#3d4f82",
          600: "#2e3d68",
          700: "#1f2d52",
          800: "#0f1729",
          900: "#080c18",
        },
        cream: {
          50: "#fefefe",
          100: "#f8f7f4",
          200: "#f0eeea",
          300: "#e5e2dc",
          400: "#d5d0c7",
          500: "#c0b9ad",
        },
        amber: {
          50: "#fdf9ef",
          100: "#f9f0d5",
          200: "#f2dfa8",
          300: "#e6c96e",
          400: "#d4a853",
          500: "#c49a3a",
          600: "#a8812e",
          700: "#8a6825",
          800: "#6f531f",
          900: "#5a441a",
        },
        sage: {
          50: "#f2f4f7",
          100: "#e2e5ed",
          200: "#c5cad9",
          300: "#9ea6bd",
          400: "#7681a1",
          500: "#576285",
          600: "#454e6b",
          700: "#383f57",
          800: "#2e3447",
          900: "#262b3b",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "fade-in-up": "fadeInUp 0.6s ease-out forwards",
        "slide-in-right": "slideInRight 0.5s ease-out forwards",
        "scale-in": "scaleIn 0.4s ease-out forwards",
        marquee: "marqueeScroll 120s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        marqueeScroll: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
