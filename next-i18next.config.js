/** @type {import('next-i18next').UserConfig} */
module.exports = {
  i18n: {
    defaultLocale: "ko",
    locales: ["ko", "en"],
    localeDetection: false,
  },
  localePath: typeof window === "undefined" ? require("path").join(process.cwd(), "public/locales") : "/locales",
  reloadOnPrerender: process.env.NODE_ENV === "development",
};
