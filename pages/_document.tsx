import Document, {
  DocumentContext,
  Head,
  Html,
  Main,
  NextScript,
} from "next/document";
import { dmSerif, outfit } from "@/lib/fonts";

type Props = {
  locale: string;
};

export default class MyDocument extends Document<Props> {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    return {
      ...initialProps,
      locale: ctx.locale ?? "en",
    };
  }

  render() {
    const { locale } = this.props;

    return (
      <Html
        lang={locale}
        className={`${dmSerif.variable} ${outfit.variable}`}
      >
        <Head>
          <link rel="icon" href="/logo/favicon.svg" type="image/svg+xml" />
          <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
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
