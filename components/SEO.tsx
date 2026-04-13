import Head from "next/head";
import { useRouter } from "next/router";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : "https://mortly.ca");

interface SEOProps {
  title: string;
  description: string;
  ogImage?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
}

export default function SEO({
  title,
  description,
  ogImage = `${SITE_URL}/og-default.png`,
  noindex = false,
  jsonLd,
}: SEOProps) {
  const { asPath, locale, locales } = useRouter();
  const path = asPath.split("?")[0].split("#")[0];
  const canonical = `${SITE_URL}${locale === "ko" ? "" : `/${locale}`}${path === "/" ? "" : path}`;

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      {/* Canonical */}
      <link rel="canonical" href={canonical} />

      {/* hreflang for bilingual support */}
      {locales?.map((loc) => (
        <link
          key={loc}
          rel="alternate"
          hrefLang={loc}
          href={`${SITE_URL}${loc === "ko" ? "" : `/${loc}`}${path === "/" ? "" : path}`}
        />
      ))}
      <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}${path === "/" ? "" : path}`} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="mortly" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content={locale === "ko" ? "ko_KR" : "en_CA"} />

      {/* Twitter / X */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* JSON-LD structured data */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
    </Head>
  );
}
