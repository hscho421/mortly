/**
 * Shared i18n configuration (single canonical set of locales/namespace).
 *
 * The web keeps its own Next pipeline config in next-i18next.config.js and is
 * deeply coupled to `public/locales` — it serves the JSON at `/locales/*` for
 * the client, caches it in the service worker, and traces it for SSR — so those
 * translation FILES stay exactly where they are (moving them would break the
 * live site's client-side i18n).
 *
 * The strings themselves live in `public/locales/{ko,en}/common.json`. The
 * mobile app imports that SAME JSON as its i18next resources, so both platforms
 * use identical keys + copy — unified i18n without relocating the files.
 */
export const LOCALES = ["ko", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ko";
export const I18N_NAMESPACE = "common";

export function isLocale(x: unknown): x is Locale {
  return typeof x === "string" && (LOCALES as readonly string[]).includes(x);
}
