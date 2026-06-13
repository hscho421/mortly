/** @type {import('next-i18next').UserConfig} */
module.exports = {
  i18n: {
    defaultLocale: "ko",
    locales: ["ko", "en"],
    // localeDetection is OMITTED, which means "on" (Next's default). That's
    // what we want: the NEXT_LOCALE cookie set by the Navbar switcher is
    // honored across full-page round-trips/return visits, and English-browser
    // first-time visitors land on /en. NOTE: Next 16 only accepts the literal
    // `false` here — setting `localeDetection: true` is INVALID and logs a
    // config warning (Next ignores it and uses the default anyway). For a
    // strict Korean-first landing regardless of browser/cookie, set this to
    // `false` (and locale only changes via the explicit switcher).
  },
  localePath: typeof window === "undefined" ? require("path").join(process.cwd(), "public/locales") : "/locales",
  reloadOnPrerender: process.env.NODE_ENV === "development",
};
