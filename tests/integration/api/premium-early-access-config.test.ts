import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";

// getPremiumAccessConfig reads settings via getSettingBool/getSettingInt.
vi.mock("@/lib/settings", () => ({
  getSettingBool: vi.fn(),
  getSettingInt: vi.fn(),
  getSetting: vi.fn(async () => ""),
  invalidateSettingsCache: vi.fn(),
}));

import { getSettingBool, getSettingInt } from "@/lib/settings";
import handler from "@/pages/api/premium-early-access";

describe("GET /api/premium-early-access", () => {
  beforeEach(() => {
    vi.mocked(getSettingInt).mockImplementation(async (k: string) =>
      ({ premium_window_hours: 12, premium_valve_hours: 6, premium_valve_min_responses: 2 })[k] ?? 0,
    );
  });

  it("exposes only the public config (enabled + windowHours)", async () => {
    vi.mocked(getSettingBool).mockResolvedValue(true);
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(jsonBody(res)).toEqual({ enabled: true, windowHours: 12 });
  });

  it("reports disabled when the master toggle is off", async () => {
    vi.mocked(getSettingBool).mockResolvedValue(false);
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(jsonBody<{ enabled: boolean }>(res).enabled).toBe(false);
  });

  it("sets a short CDN cache header", async () => {
    vi.mocked(getSettingBool).mockResolvedValue(true);
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.getHeader("Cache-Control")).toBe("s-maxage=30, stale-while-revalidate=60");
  });

  it("500s when settings are malformed", async () => {
    vi.mocked(getSettingBool).mockResolvedValue(true);
    vi.mocked(getSettingInt).mockRejectedValueOnce(new Error("bad"));
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(500);
  });
});
