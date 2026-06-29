import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import "@/tests/mocks/next-auth";
import { prismaMock } from "@/tests/mocks/prisma";
import { setSession, adminSession, clearSession } from "@/tests/mocks/next-auth";
import { makeReqRes } from "@/tests/utils/apiHelpers";

import handler from "@/pages/api/analytics/geo";

// A realistic mobile Safari UA (non-bot) and a Vercel edge geo header set.
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function vercelHeaders(extra: Record<string, string> = {}) {
  return {
    "user-agent": MOBILE_UA,
    "x-vercel-ip-country": "CA",
    "x-vercel-ip-country-region": "ON",
    // Vercel URL-encodes the city; "Québec City" round-trips through decode.
    "x-vercel-ip-city": "Qu%C3%A9bec%20City",
    "x-vercel-ip-latitude": "43.6532",
    "x-vercel-ip-longitude": "-79.3832",
    "x-vercel-ip-timezone": "America/Toronto",
    ...extra,
  };
}

describe("POST /api/analytics/geo (cookieless geo beacon)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSession();
    prismaMock.geoVisit.create.mockResolvedValue({} as never);
  });

  it("405s on non-POST", async () => {
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(prismaMock.geoVisit.create).not.toHaveBeenCalled();
  });

  it("skips bots without inserting (204)", async () => {
    const { req, res } = makeReqRes({
      method: "POST",
      headers: vercelHeaders({ "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" }),
    });
    await handler(req, res);
    expect(res.statusCode).toBe(204);
    expect(prismaMock.geoVisit.create).not.toHaveBeenCalled();
  });

  it("no-ops off-Vercel when the geo country header is absent (204)", async () => {
    const { req, res } = makeReqRes({
      method: "POST",
      headers: { "user-agent": DESKTOP_UA }, // non-bot, but no x-vercel-ip-* headers
    });
    await handler(req, res);
    expect(res.statusCode).toBe(204);
    expect(prismaMock.geoVisit.create).not.toHaveBeenCalled();
  });

  it("excludes signed-in admins so staff traffic doesn't skew the data (204)", async () => {
    setSession(adminSession());
    const { req, res } = makeReqRes({ method: "POST", headers: vercelHeaders() });
    await handler(req, res);
    expect(res.statusCode).toBe(204);
    expect(prismaMock.geoVisit.create).not.toHaveBeenCalled();
  });

  it("inserts an anonymous visit with decoded city, parsed coords, device & referrer host — and NO IP/PII", async () => {
    const { req, res } = makeReqRes({
      method: "POST",
      headers: vercelHeaders(),
      body: { path: "/find", referrer: "https://www.google.com/search?q=mortgage" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(204);
    expect(prismaMock.geoVisit.create).toHaveBeenCalledTimes(1);

    const data = prismaMock.geoVisit.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).toMatchObject({
      country: "CA",
      region: "ON",
      city: "Québec City", // decodeURIComponent applied
      lat: 43.6532,
      lng: -79.3832,
      timezone: "America/Toronto",
      device: "mobile", // from the iPhone UA
      referrer: "www.google.com", // host only, not the full URL/query
      path: "/find",
      role: "anon",
    });
    // Privacy invariant: the row must never carry a raw IP address.
    expect(Object.keys(data)).not.toContain("ip");
  });

  it("classifies a desktop UA and falls back to 'direct' when no referrer is present", async () => {
    const { req, res } = makeReqRes({
      method: "POST",
      headers: vercelHeaders({ "user-agent": DESKTOP_UA }),
      body: {},
    });
    await handler(req, res);

    const data = prismaMock.geoVisit.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.device).toBe("desktop");
    expect(data.referrer).toBe("direct");
  });

  it("never throws if the insert fails — analytics must not break a page load", async () => {
    prismaMock.geoVisit.create.mockRejectedValue(new Error("db down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { req, res } = makeReqRes({ method: "POST", headers: vercelHeaders() });

    await handler(req, res);

    expect(res.statusCode).toBe(204);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
