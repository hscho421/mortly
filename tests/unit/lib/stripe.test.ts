import { describe, it, expect, beforeEach, vi } from "vitest";

// The stripe helpers read env vars at call time via TIER_PRICE_MAP closure —
// these are set in tests/utils/setup.ts. We import AFTER setup to pick them up.
import { getPriceIdForTier, getTierForPriceId, getCreditsForTier } from "@/lib/stripe";

vi.mock("@/lib/settings", () => ({
  getSettingInt: vi.fn(async (key: string) => {
    const map: Record<string, number> = {
      free_tier_credits: 0,
      basic_tier_credits: 5,
      pro_tier_credits: 20,
    };
    return map[key] ?? 0;
  }),
}));

describe("tier ↔ priceId mapping", () => {
  it("round-trips each paid tier", () => {
    const basic = getPriceIdForTier("BASIC");
    const pro = getPriceIdForTier("PRO");
    const premium = getPriceIdForTier("PREMIUM");

    expect(basic).toBe("price_basic_test");
    expect(pro).toBe("price_pro_test");
    expect(premium).toBe("price_premium_test");

    expect(getTierForPriceId(basic!)).toBe("BASIC");
    expect(getTierForPriceId(pro!)).toBe("PRO");
    expect(getTierForPriceId(premium!)).toBe("PREMIUM");
  });

  it("FREE has no price id", () => {
    expect(getPriceIdForTier("FREE")).toBeUndefined();
  });

  it("unknown price id returns undefined", () => {
    expect(getTierForPriceId("price_nope")).toBeUndefined();
  });
});

describe("getCreditsForTier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PREMIUM returns -1 sentinel (unlimited) without DB lookup", async () => {
    expect(await getCreditsForTier("PREMIUM")).toBe(-1);
  });

  it("reads BASIC from settings", async () => {
    expect(await getCreditsForTier("BASIC")).toBe(5);
  });

  it("reads PRO from settings", async () => {
    expect(await getCreditsForTier("PRO")).toBe(20);
  });

  it("unknown tier returns 0", async () => {
    expect(await getCreditsForTier("BOGUS")).toBe(0);
  });
});
