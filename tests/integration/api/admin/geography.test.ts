import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import "@/tests/mocks/next-auth";
import { prismaMock } from "@/tests/mocks/prisma";
import { setSession, adminSession, brokerSession } from "@/tests/mocks/next-auth";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";

import handler from "@/pages/api/admin/geography";

interface GeoResponse {
  days: number;
  total: number;
  mobilePct: number;
  countriesReached: number;
  provincesReached: number;
  citiesReached: number;
  byCountry: Array<{ code: string; count: number }>;
  byProvince: Array<{ region: string; name: string; count: number }>;
  caCities: Array<{ city: string; province: string; lat: number | null; lng: number | null; count: number }>;
  topCities: Array<{ city: string; country: string; count: number }>;
}

// The handler runs nine queries in Promise.all; the mocks are queued in that
// exact order: count(total), count(mobile), then groupBy ×7, then $queryRaw.
function seedAggregates() {
  prismaMock.geoVisit.count
    .mockResolvedValueOnce(100 as never) // total
    .mockResolvedValueOnce(40 as never); // mobile
  prismaMock.geoVisit.groupBy
    .mockResolvedValueOnce([
      { country: "CA", _count: { _all: 80 } },
      { country: "US", _count: { _all: 15 } },
      { country: "KR", _count: { _all: 5 } },
    ] as never) // byCountry (global)
    .mockResolvedValueOnce([
      { region: "ON", _count: { _all: 50 } },
      { region: "BC", _count: { _all: 30 } },
    ] as never) // byProvince (CA)
    .mockResolvedValueOnce([
      { city: "Toronto", region: "ON", lat: 43.7, lng: -79.4, _count: { _all: 50 } },
      { city: "Vancouver", region: "BC", lat: 49.2, lng: -123.1, _count: { _all: 30 } },
    ] as never) // CA cities (with lat/lng)
    .mockResolvedValueOnce([
      { city: "Toronto", country: "CA", _count: { _all: 50 } },
      { city: "Vancouver", country: "CA", _count: { _all: 30 } },
      { city: "New York", country: "US", _count: { _all: 15 } },
      { city: "Seoul", country: "KR", _count: { _all: 5 } },
    ] as never) // global cities
    .mockResolvedValueOnce([
      { device: "desktop", _count: { _all: 60 } },
      { device: "mobile", _count: { _all: 40 } },
    ] as never) // device
    .mockResolvedValueOnce([
      { referrer: "direct", _count: { _all: 70 } },
      { referrer: "google.com", _count: { _all: 30 } },
    ] as never) // referrer
    .mockResolvedValueOnce([
      { role: "anon", _count: { _all: 95 } },
      { role: "broker", _count: { _all: 5 } },
    ] as never); // role
  prismaMock.$queryRaw.mockResolvedValue([
    { day: new Date("2026-06-28T00:00:00Z"), count: 50n },
    { day: new Date("2026-06-29T00:00:00Z"), count: 50n },
  ] as never);
}

describe("GET /api/admin/geography (global geography)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(adminSession());
  });

  it("403s for a non-admin and never queries the table", async () => {
    setSession(brokerSession());
    const { req, res } = makeReqRes({ method: "GET", query: { days: "7" } });
    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(prismaMock.geoVisit.groupBy).not.toHaveBeenCalled();
  });

  it("405s on a non-GET method", async () => {
    const { req, res } = makeReqRes({ method: "POST" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("returns global country/continent counts plus the Canada drill-down", async () => {
    seedAggregates();
    const { req, res } = makeReqRes({ method: "GET", query: { days: "7" } });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const b = jsonBody<GeoResponse>(res);

    expect(b.days).toBe(7);
    expect(b.total).toBe(100);
    expect(b.mobilePct).toBe(40);
    expect(b.countriesReached).toBe(3);
    expect(b.provincesReached).toBe(2);
    // citiesReached is GLOBAL distinct (city, country), not CA-scoped.
    expect(b.citiesReached).toBe(4);

    // Countries come back as alpha-2 codes, sorted by volume.
    expect(b.byCountry[0]).toEqual({ code: "CA", count: 80 });
    expect(b.byCountry.map((c) => c.code)).toEqual(["CA", "US", "KR"]);

    // CA drill-down keeps lat/lng + the resolved province name for map bubbles.
    expect(b.caCities[0]).toMatchObject({
      city: "Toronto",
      province: "Ontario",
      lat: 43.7,
      lng: -79.4,
      count: 50,
    });

    // Global cities carry their own country (a US/KR city would never appear
    // in the old CA-only list).
    expect(b.topCities).toContainEqual({ city: "New York", country: "US", count: 15 });
    expect(b.topCities.find((c) => c.city === "Seoul")).toMatchObject({ country: "KR" });
  });

  it("accepts the 1-day (last 24h) window", async () => {
    seedAggregates();
    const { req, res } = makeReqRes({ method: "GET", query: { days: "1" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(jsonBody<GeoResponse>(res).days).toBe(1);
  });

  it("clamps an out-of-range days param to the 30-day default", async () => {
    seedAggregates();
    const { req, res } = makeReqRes({ method: "GET", query: { days: "999" } });
    await handler(req, res);
    expect(jsonBody<GeoResponse>(res).days).toBe(30);
  });
});
