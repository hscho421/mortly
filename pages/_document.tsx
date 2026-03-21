import { Html, Head, Main, NextScript } from "next/document";
import { dmSerif, outfit, notoSansKR } from "@/lib/fonts";

export default function Document() {
  return (
    <Html
      lang="en"
      className={`${dmSerif.variable} ${outfit.variable} ${notoSansKR.variable}`}
    >
      <Head />
      <body className="antialiased">
        <div className="grain-overlay" aria-hidden="true" />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
