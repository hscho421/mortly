// NativeWind (Tailwind for React Native). Pulls the Midnight & Gold palette,
// fonts, and letter-spacing straight from @mortly/core/tokens so the app and
// the web share ONE source of truth. Imported by relative path — the Tailwind
// config loader (jiti) transpiles the TS + resolves it most reliably here.
import type { Config } from "tailwindcss";
import { colors, fontFamily, letterSpacing } from "../../packages/core/src/tokens";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nativewindPreset = require("nativewind/preset");

const config: Config = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [nativewindPreset],
  theme: {
    extend: {
      colors,
      fontFamily,
      letterSpacing,
    },
  },
  plugins: [],
};

export default config;
