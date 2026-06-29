import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";
import { provinceName } from "@/lib/geo/provinces";

/**
 * GET /api/admin/geography?days=7|30|90
 *
 * Aggregates the cookieless GeoVisit table for the admin Geography dashboard:
 * totals, by-province (joined to map names), top cities (with lat/lng for the
 * choropleth bubbles), device/referrer/role/country breakdowns, and a daily
 * series. Canada-scoped for the map/province/city cuts; countries listed too.
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
    byCityRaw,
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
    .map((r) => ({ country: r.country, count: r._count._all }))
    .sort(sortDesc);

  const byProvince = byProvinceRaw
    .map((r) => ({ region: r.region as string, name: provinceName(r.region), count: r._count._all }))
    .sort(sortDesc);

  // Merge cities by city+region (lat/lng are the city centroid from Vercel and
  // are normally identical, but coalesce defensively).
  const cityMap = new Map<
    string,
    { city: string; region: string | null; lat: number | null; lng: number | null; count: number }
  >();
  for (const r of byCityRaw) {
    const key = `${r.city}|${r.region ?? ""}`;
    const prev = cityMap.get(key);
    if (prev) {
      prev.count += r._count._all;
      prev.lat = prev.lat ?? r.lat;
      prev.lng = prev.lng ?? r.lng;
    } else {
      cityMap.set(key, {
        city: r.city as string,
        region: r.region,
        lat: r.lat,
        lng: r.lng,
        count: r._count._all,
      });
    }
  }
  const cities = [...cityMap.values()].sort(sortDesc);
  const topCities = cities.slice(0, 50).map((c) => ({
    city: c.city,
    region: c.region,
    province: provinceName(c.region),
    lat: c.lat,
    lng: c.lng,
    count: c.count,
  }));

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
    provincesReached: byProvince.length,
    citiesReached: cities.length,
    byCountry,
    byProvince,
    topCities,
    byDevice,
    byReferrer,
    byRole,
    daily,
  });
});
