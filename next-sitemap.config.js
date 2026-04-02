/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://mortly.ca",
  generateRobotsTxt: false, // we manage robots.txt manually
  exclude: [
    "/admin/*",
    "/borrower/*",
    "/broker/*",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/select-role",
    "/404",
    "/500",
  ],
  alternateRefs: [
    { href: "https://mortly.ca", hreflang: "ko" },
    { href: "https://mortly.ca/en", hreflang: "en" },
  ],
};
