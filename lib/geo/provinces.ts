// ISO 3166-2:CA subdivision codes (what Vercel's x-vercel-ip-country-region
// returns) → the province/territory name used in the bundled choropleth
// (public/geo/canada-provinces.geo.json), so byProvince counts can join the map.
export const CA_PROVINCE_NAME: Record<string, string> = {
  ON: "Ontario",
  QC: "Quebec",
  BC: "British Columbia",
  AB: "Alberta",
  MB: "Manitoba",
  SK: "Saskatchewan",
  NS: "Nova Scotia",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  PE: "Prince Edward Island",
  NT: "Northwest Territories",
  YT: "Yukon Territory",
  NU: "Nunavut",
};

export function provinceName(code: string | null | undefined): string {
  if (!code) return "—";
  return CA_PROVINCE_NAME[code] ?? code;
}
