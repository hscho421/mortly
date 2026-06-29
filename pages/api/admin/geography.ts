import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";
import { provinceName } from "@/lib/geo/provinces";

/**
 * GET /api/admin/geography?days=7|30|90
 *
 * Aggregates the cookieless GeoVisit table for the admin Geography dashboard.
 * Global cuts: totals, mobile %, by-country, global top cities, plus the
 * device/referrer/role/daily breakdowns. Canada drill-down: by-province and
 * CA cities (with lat/lng for the Canada choropleth bubbles).
 */

const ALLOWED_DAYS = [7, 30, 90];

export default withAdmin(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const daysParam = Number.parseInt(String(req.query.days ?? "30"), 10);
  const days = ALLOWED_DAYS.includes(daysParam) ? daysParam : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const base = { createdAt: { gte: cutoff } };
  const caBase = { ...base, country: "CA" };

  const [
    total,
    mobileCount,
    byCountryRaw,
    byProvinceRaw,
    caCityRaw,
    globalCityRaw,
    byDeviceRaw,
    byReferrerRaw,
    byRoleRaw,
    dailyRaw,
  ] = await Promise.all([
    prisma.geoVisit.count({ where: base }),
    prisma.geoVisit.count({ where: { ...base, device: "mobile" } }),
    prisma.geoVisit.groupBy({ by: ["country"], where: base, _count: { _all: true } }),
    prisma.geoVisit.groupBy({
      by: ["region"],
      where: { ...caBase, region: { not: null } },
      _count: { _all: true },
    }),
    prisma.geoVisit.groupBy({
      by: ["city", "region", "lat", "lng"],
      where: { ...caBase, city: { not: null } },
      _count: { _all: true },
    }),
    prisma.geoVisit.groupBy({
      by: ["city", "country"],
      where: { ...base, city: { not: null } },
      _count: { _all: true },
    }),
    prisma.geoVisit.groupBy({ by: ["device"], where: base, _count: { _all: true } }),
    prisma.geoVisit.groupBy({ by: ["referrer"], where: base, _count: { _all: true } }),
    prisma.geoVisit.groupBy({ by: ["role"], where: base, _count: { _all: true } }),
    prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
      FROM "geo_visits"
      WHERE "createdAt" >= ${cutoff}
      GROUP BY day
      ORDER BY day ASC`,
  ]);

  const sortDesc = <T extends { count: number }>(a: T, b: T) => b.count - a.count;

  const byCountry = byCountryRaw
    .map((r) => ({ code: r.country, count: r._count._all }))
    .sort(sortDesc);

  const byProvince = byProvinceRaw
    .map((r) => ({ region: r.region as string, name: provinceName(r.region), count: r._count._all }))
    .sort(sortDesc);

  // CA cities (centroids for the Canada map bubbles). Merge by city+region.
  const caMap = new Map<
    string,
    { city: string; region: string | null; lat: number | null; lng: number | null; count: number }
  >();
  for (const r of caCityRaw) {
    const key = `${r.city}|${r.region ?? ""}`;
    const prev = caMap.get(key);
    if (prev) {
      prev.count += r._count._all;
      prev.lat = prev.lat ?? r.lat;
      prev.lng = prev.lng ?? r.lng;
    } else {
      caMap.set(key, {
        city: r.city as string,
        region: r.region,
        lat: r.lat,
        lng: r.lng,
        count: r._count._all,
      });
    }
  }
  const caCities = [...caMap.values()].sort(sortDesc).slice(0, 50).map((c) => ({
    city: c.city,
    region: c.region,
    province: provinceName(c.region),
    lat: c.lat,
    lng: c.lng,
    count: c.count,
  }));

  // Global cities (merge by city+country) for the world/list view.
  const globalCityMap = new Map<string, { city: string; country: string; count: number }>();
  for (const r of globalCityRaw) {
    const key = `${r.city}|${r.country}`;
    const prev = globalCityMap.get(key);
    if (prev) prev.count += r._count._all;
    else globalCityMap.set(key, { city: r.city as string, country: r.country, count: r._count._all });
  }
  const globalCities = [...globalCityMap.values()].sort(sortDesc);
  const topCities = globalCities.slice(0, 50);

  const byDevice = byDeviceRaw
    .map((r) => ({ device: r.device ?? "unknown", count: r._count._all }))
    .sort(sortDesc);

  const byReferrer = byReferrerRaw
    .map((r) => ({ referrer: r.referrer ?? "direct", count: r._count._all }))
    .sort(sortDesc)
    .slice(0, 15);

  const byRole = byRoleRaw.map((r) => ({ role: r.role, count: r._count._all })).sort(sortDesc);

  const daily = dailyRaw.map((r) => ({
    date: new Date(r.day).toISOString().slice(0, 10),
    count: Number(r.count),
  }));

  return res.status(200).json({
    days,
    total,
    mobilePct: total > 0 ? Math.round((mobileCount / total) * 100) : 0,
    countriesReached: byCountry.length,
    provincesReached: byProvince.length,
    citiesReached: globalCityMap.size,
    byCountry,
    byProvince,
    caCities,
    topCities,
    byDevice,
    byReferrer,
    byRole,
    daily,
  });
});
