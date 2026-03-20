import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { appWithTranslation } from "next-i18next";
import { Analytics } from "@vercel/analytics/react";
import { DM_Serif_Display, Outfit, Noto_Sans_KR } from "next/font/google";

const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-korean",
  display: "swap",
  preload: true,
});

function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  return (
    <SessionProvider session={session}>
      <div className={`${dmSerif.variable} ${outfit.variable} ${notoSansKR.variable}`}>
        <Component {...pageProps} />
      </div>
      <Analytics />
    </SessionProvider>
  );
}

export default appWithTranslation(App);
