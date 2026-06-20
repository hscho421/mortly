import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";

// getCreditsForTier (lib/stripe) reads these via getSettingInt — mock the
// settings layer so the grants are deterministic.
vi.mock("@/lib/settings", () => ({
  getSettingInt: vi.fn(),
  getSettingBool: vi.fn(async () => false),
  getSetting: vi.fn(async () => ""),
  invalidateSettingsCache: vi.fn(),
}));

import { getSettingInt } from "@/lib/settings";
import handler from "@/pages/api/tier-credits";

const CREDITS: Record<string, number> = {
  free_tier_credits: 0,
  basic_tier_credits: 5,
  pro_tier_credits: 20,
};

describe("GET /api/tier-credits", () => {
  beforeEach(() => {
    vi.mocked(getSettingInt).mockImplementation(async (k: string) => CREDITS[k] ?? 0);
  });

  it("returns the live per-tier credits from settings (PREMIUM = -1 unlimited)", async () => {
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(jsonBody(res)).toEqual({ FREE: 0, BASIC: 5, PRO: 20, PREMIUM: -1 });
  });

  it("sets a short CDN cache header (matches /api/maintenance)", async () => {
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.getHeader("Cache-Control")).toBe("s-maxage=30, stale-while-revalidate=60");
  });

  it("500s when a setting is malformed (getSettingInt throws)", async () => {
    vi.mocked(getSettingInt).mockRejectedValueOnce(new Error("not a valid integer"));
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(500);
  });
});
