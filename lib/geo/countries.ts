// alpha-2 (ISO 3166-1, what Vercel x-vercel-ip-country returns) -> continent slug.
// Generated from Natural Earth 110m; used to group global sessions by continent.
// Country NAMES are resolved at runtime via Intl.DisplayNames (see countryName).
export type ContinentSlug =
  | "africa"
  | "antarctica"
  | "asia"
  | "europe"
  | "northAmerica"
  | "oceania"
  | "southAmerica"
  | "other";

export const COUNTRY_CONTINENT: Record<string, ContinentSlug> = {
  AE: "asia",
  AF: "asia",
  AL: "europe",
  AM: "asia",
  AO: "africa",
  AQ: "antarctica",
  AR: "southAmerica",
  AT: "europe",
  AU: "oceania",
  AZ: "asia",
  BA: "europe",
  BD: "asia",
  BE: "europe",
  BF: "africa",
  BG: "europe",
  BI: "africa",
  BJ: "africa",
  BN: "asia",
  BO: "southAmerica",
  BR: "southAmerica",
  BS: "northAmerica",
  BT: "asia",
  BW: "africa",
  BY: "europe",
  BZ: "northAmerica",
  CA: "northAmerica",
  CD: "africa",
  CF: "africa",
  CG: "africa",
  CH: "europe",
  CI: "africa",
  CL: "southAmerica",
  CM: "africa",
  CN: "asia",
  CO: "southAmerica",
  CR: "northAmerica",
  CU: "northAmerica",
  CY: "asia",
  CZ: "europe",
  DE: "europe",
  DJ: "africa",
  DK: "europe",
  DO: "northAmerica",
  DZ: "africa",
  EC: "southAmerica",
  EE: "europe",
  EG: "africa",
  EH: "africa",
  ER: "africa",
  ES: "europe",
  ET: "africa",
  FI: "europe",
  FJ: "oceania",
  FK: "southAmerica",
  FR: "europe",
  GA: "africa",
  GB: "europe",
  GE: "asia",
  GH: "africa",
  GL: "northAmerica",
  GM: "africa",
  GN: "africa",
  GQ: "africa",
  GR: "europe",
  GT: "northAmerica",
  GW: "africa",
  GY: "southAmerica",
  HN: "northAmerica",
  HR: "europe",
  HT: "northAmerica",
  HU: "europe",
  ID: "asia",
  IE: "europe",
  IL: "asia",
  IN: "asia",
  IQ: "asia",
  IR: "asia",
  IS: "europe",
  IT: "europe",
  JM: "northAmerica",
  JO: "asia",
  JP: "asia",
  KE: "africa",
  KG: "asia",
  KH: "asia",
  KP: "asia",
  KR: "asia",
  KW: "asia",
  KZ: "asia",
  LA: "asia",
  LB: "asia",
  LK: "asia",
  LR: "africa",
  LS: "africa",
  LT: "europe",
  LU: "europe",
  LV: "europe",
  LY: "africa",
  MA: "africa",
  MD: "europe",
  ME: "europe",
  MG: "africa",
  MK: "europe",
  ML: "africa",
  MM: "asia",
  MN: "asia",
  MR: "africa",
  MW: "africa",
  MX: "northAmerica",
  MY: "asia",
  MZ: "africa",
  NA: "africa",
  NC: "oceania",
  NE: "africa",
  NG: "africa",
  NI: "northAmerica",
  NL: "europe",
  NO: "europe",
  NP: "asia",
  NZ: "oceania",
  OM: "asia",
  PA: "northAmerica",
  PE: "southAmerica",
  PG: "oceania",
  PH: "asia",
  PK: "asia",
  PL: "europe",
  PR: "northAmerica",
  PS: "asia",
  PT: "europe",
  PY: "southAmerica",
  QA: "asia",
  RO: "europe",
  RS: "europe",
  RU: "europe",
  RW: "africa",
  SA: "asia",
  SB: "oceania",
  SD: "africa",
  SE: "europe",
  SI: "europe",
  SK: "europe",
  SL: "africa",
  SN: "africa",
  SO: "africa",
  SR: "southAmerica",
  SS: "africa",
  SV: "northAmerica",
  SY: "asia",
  SZ: "africa",
  TD: "africa",
  TF: "other",
  TG: "africa",
  TH: "asia",
  TJ: "asia",
  TL: "asia",
  TM: "asia",
  TN: "africa",
  TR: "asia",
  TT: "northAmerica",
  TW: "asia",
  TZ: "africa",
  UA: "europe",
  UG: "africa",
  US: "northAmerica",
  UY: "southAmerica",
  UZ: "asia",
  VE: "southAmerica",
  VN: "asia",
  VU: "oceania",
  XK: "europe",
  YE: "asia",
  ZA: "africa",
  ZM: "africa",
  ZW: "africa",
};

export function continentOf(code: string | null | undefined): ContinentSlug {
  if (!code) return "other";
  return COUNTRY_CONTINENT[code.toUpperCase()] ?? "other";
}

// [lng, lat] fallback centroids for small countries/territories the bundled
// 110m world geojson omits (city-states, micro-states). Vercel still returns
// these alpha-2 codes, so the WorldMap uses these to place a bubble instead of
// silently dropping a country that only appears in the list.
export const COUNTRY_CENTROID_FALLBACK: Record<string, [number, number]> = {
  SG: [103.82, 1.35], // Singapore
  HK: [114.17, 22.32], // Hong Kong
  MO: [113.55, 22.2], // Macau
  MT: [14.45, 35.9], // Malta
  BH: [50.55, 26.07], // Bahrain
  MV: [73.5, 3.2], // Maldives
  MU: [57.55, -20.28], // Mauritius
  BB: [-59.54, 13.19], // Barbados
  MC: [7.42, 43.74], // Monaco
  LI: [9.55, 47.16], // Liechtenstein
  AD: [1.52, 42.55], // Andorra
  PR: [-66.5, 18.2], // Puerto Rico
  GI: [-5.35, 36.14], // Gibraltar
};

// Memoized Intl.DisplayNames per language — localizes an ISO alpha-2 code to a
// country name (e.g. "CA" -> "Canada" / "캐나다"). Falls back to the raw code on
// unsupported runtimes/codes so the UI never shows blank.
const _dn: Record<string, Intl.DisplayNames | null> = {};
function displayNames(lang: string): Intl.DisplayNames | null {
  if (lang in _dn) return _dn[lang];
  try {
    _dn[lang] = new Intl.DisplayNames([lang], { type: "region" });
  } catch {
    _dn[lang] = null;
  }
  return _dn[lang];
}

export function countryName(code: string | null | undefined, lang = "en", fallback?: string): string {
  if (!code) return fallback ?? "—";
  const up = code.toUpperCase();
  const dn = displayNames(lang);
  if (dn) {
    try {
      const n = dn.of(up);
      if (n && n !== up) return n;
    } catch {
      // ignore — fall through
    }
  }
  return fallback ?? up;
}
