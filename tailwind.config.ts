import type { Config } from "tailwindcss";
// Midnight & Gold brand tokens — shared with the mobile app via @mortly/core.
// Imported by relative path (most reliable for the Tailwind config loader).
import { colors, fontFamily, letterSpacing } from "./packages/core/src/tokens";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors,
      fontFamily,
      letterSpacing,
      boxShadow: {
        card: "0 1px 3px rgba(15,23,41,0.04), 0 1px 2px rgba(15,23,41,0.06)",
        "card-hover":
          "0 10px 15px rgba(15,23,41,0.06), 0 4px 6px rgba(15,23,41,0.04)",
        elevated:
          "0 20px 25px rgba(15,23,41,0.08), 0 8px 10px rgba(15,23,41,0.04)",
        "amber-glow": "0 4px 14px rgba(196,154,58,0.25)",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "fade-in-up": "fadeInUp 0.6s ease-out forwards",
        "slide-in-right": "slideInRight 0.5s ease-out forwards",
        "scale-in": "scaleIn 0.4s ease-out forwards",
        "slide-up": "slideUp 0.22s ease-out forwards",
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
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
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
