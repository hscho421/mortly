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
  // Security headers applied to every response.
  // CSP `script-src` keeps `'unsafe-inline'` for now because Next.js inlines a
  // small bootstrap script per page; tightening to nonces is a separate
  // hardening pass once we measure the impact on the i18n SSR pipeline.
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    // CSP directives. Externally-hosted fonts (Outfit via Google Fonts,
    // Pretendard via jsdelivr) are loaded by pages/_document.tsx, so we
    // allowlist their stylesheet hosts in style-src and the font CDNs
    // (gstatic + jsdelivr) in font-src.
    //
    // `upgrade-insecure-requests` is omitted in dev because Next's dev
    // server runs on http://; with the directive, every chunk gets upgraded
    // to https:// and fails with ERR_SSL_PROTOCOL_ERROR locally. Prod runs
    // over https end-to-end so the directive is safe + useful there.
    const directives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://us.i.posthog.com https://us-assets.i.posthog.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
      "connect-src 'self' https://api.stripe.com https://us.i.posthog.com https://us-assets.i.posthog.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ];
    if (isProd) directives.push("upgrade-insecure-requests");
    const csp = directives.join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=(), payment=(self \"https://js.stripe.com\")" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
