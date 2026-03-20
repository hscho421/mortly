import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body className="antialiased">
        <div className="grain-overlay" aria-hidden="true" />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
