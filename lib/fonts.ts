import { DM_Serif_Display, Outfit, Noto_Sans_KR } from "next/font/google";

export const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-korean",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["Noto Sans KR Fallback", "Apple SD Gothic Neo", "Malgun Gothic", "system-ui", "sans-serif"],
  preload: true,
});
