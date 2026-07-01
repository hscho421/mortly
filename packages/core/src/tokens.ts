/**
 * Midnight & Gold design tokens — the single cross-platform source of truth for
 * the Mortly brand. The web Tailwind config imports these; the mobile app's
 * NativeWind config imports the same objects so both platforms stay in lockstep.
 *
 * Only platform-agnostic VALUES live here (colors, font families, letter
 * spacing). Web-only CSS (box shadows, keyframe animations) stays in
 * tailwind.config.ts; the mobile equivalents are expressed natively.
 */

export const colors = {
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
  success: { 50: "#f0fdf4", 100: "#dcfce7", 500: "#22c55e", 600: "#16a34a", 700: "#15803d" },
  error: { 50: "#fef2f2", 100: "#fee2e2", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c" },
  warning: { 50: "#fffbeb", 100: "#fef3c7", 500: "#f59e0b", 600: "#d97706", 700: "#b45309" },
  info: { 50: "#eff6ff", 100: "#dbeafe", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8" },
} as const;

// Not `as const`: Tailwind's fontFamily type requires mutable string[] arrays.
export const fontFamily: Record<string, string[]> = {
  display: ["Outfit", "system-ui", "sans-serif"],
  body: ["Outfit", "system-ui", "sans-serif"],
  mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
};

export const letterSpacing = {
  tightest: "-0.04em",
  tightest2: "-0.05em",
} as const;
