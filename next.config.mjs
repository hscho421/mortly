import i18nConfig from "./next-i18next.config.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  i18n: i18nConfig.i18n,
  async redirects() {
    return [
      {
        source: "/broker/conversations",
        destination: "/broker/messages",
        permanent: true,
      },
      {
        source: "/broker/conversations/:id",
        destination: "/broker/messages?id=:id",
        permanent: true,
      },
      {
        source: "/broker/introductions",
        destination: "/broker/messages",
        permanent: true,
      },
      {
        source: "/borrower/chat/:conversationId",
        destination: "/borrower/messages?id=:conversationId",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
