/**
 * Map a Next.js router locale ("ko" | "en") to a BCP-47 formatting locale.
 *
 * Several pages previously hardcoded "en-CA" in toLocaleDateString /
 * toLocaleTimeString, so Korean users saw English month names on a
 * Korean-default product. Thread `router.locale` (or i18n.language) through
 * this helper instead.
 */
export function dateLocale(locale?: string | null): string {
  return locale === "ko" ? "ko-KR" : "en-CA";
}
