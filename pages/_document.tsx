import Document, {
  DocumentContext,
  Head,
  Html,
  Main,
  NextScript,
} from "next/document";
import { outfit } from "@/lib/fonts";

type Props = {
  locale: string;
};

export default class MyDocument extends Document<Props> {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    return {
      ...initialProps,
      locale: ctx.locale ?? "ko",
    };
  }

  render() {
    const { locale } = this.props;

    return (
      <Html
        lang={locale}
        className={outfit.variable}
      >
        <Head>
          <link rel="icon" href="/logo/favicon.svg" type="image/svg+xml" />
          <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" href="/logo/logo.png" />
          <meta name="theme-color" content="#1B3A2D" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/pretendard-dynamic-subset.min.css"
          />
        </Head>
        <body className="antialiased">
          <div className="grain-overlay" aria-hidden="true" />
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
