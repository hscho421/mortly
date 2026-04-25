import i18nConfig from "./next-i18next.config.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  i18n: i18nConfig.i18n,
  outputFileTracingIncludes: {
    "*": ["./next-i18next.config.js", "./public/locales/**/*"],
  },
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
      // ── Admin IA migration (design_v3 → redesigned admin) ─────────
      // Old: /admin/dashboard + per-entity list pages + /admin/settings
      // New: /admin/inbox (default) + /admin/people + /admin/activity
      //      + /admin/reports (redesigned) + /admin/system
      { source: "/admin", destination: "/admin/inbox", permanent: false },
      { source: "/admin/dashboard", destination: "/admin/inbox", permanent: false },
      { source: "/admin/users", destination: "/admin/people?role=BORROWER", permanent: false },
      { source: "/admin/brokers", destination: "/admin/people?role=BROKER", permanent: false },
      { source: "/admin/requests", destination: "/admin/activity?type=REQ", permanent: false },
      { source: "/admin/conversations", destination: "/admin/activity?type=CONV", permanent: false },
      { source: "/admin/settings", destination: "/admin/system", permanent: false },
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
