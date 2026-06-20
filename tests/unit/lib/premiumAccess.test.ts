import { describe, it, expect, vi } from "vitest";

// Mocked so getPremiumAccessConfig() reads deterministic values. The pure
// functions below take config explicitly, so they need no mocking.
vi.mock("@/lib/settings", () => ({
  getSettingBool: vi.fn(async (key: string) => key === "premium_early_access_enabled"),
  getSettingInt: vi.fn(async (key: string) => {
    const map: Record<string, number> = {
      premium_window_hours: 12,
      premium_valve_hours: 6,
      premium_valve_min_responses: 2,
    };
    return map[key] ?? 0;
  }),
}));

import {
  getPremiumAccessConfig,
  isExclusiveToPremium,
  premiumWindowEndsAt,
  nonPremiumVisibilityWhere,
  shouldReleaseNow,
  type PremiumAccessConfig,
} from "@/lib/premiumAccess";

const HOUR = 3_600_000;
const CONFIG: PremiumAccessConfig = {
  enabled: true,
  windowHours: 12,
  valveHours: 6,
  minResponses: 2,
};
const OFF: PremiumAccessConfig = { ...CONFIG, enabled: false };
const NOW = new Date("2026-06-21T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * HOUR);

describe("isExclusiveToPremium", () => {
  it("is false when the feature is disabled, even inside the window", () => {
    expect(isExclusiveToPremium({ approvedAt: hoursAgo(1), premiumReleasedAt: null }, OFF, NOW)).toBe(false);
  });

  it("is false once the release latch is set", () => {
    expect(
      isExclusiveToPremium({ approvedAt: hoursAgo(1), premiumReleasedAt: hoursAgo(0.5) }, CONFIG, NOW),
    ).toBe(false);
  });

  it("is false for a legacy request with no approvedAt", () => {
    expect(isExclusiveToPremium({ approvedAt: null, premiumReleasedAt: null }, CONFIG, NOW)).toBe(false);
  });

  it("is true inside the window (unreleased, approved < cap ago)", () => {
    expect(isExclusiveToPremium({ approvedAt: hoursAgo(3), premiumReleasedAt: null }, CONFIG, NOW)).toBe(true);
  });

  it("is false once the hard cap has elapsed (read-time backstop)", () => {
    expect(isExclusiveToPremium({ approvedAt: hoursAgo(13), premiumReleasedAt: null }, CONFIG, NOW)).toBe(false);
  });

  it("is false exactly at the cap boundary (now == approvedAt + window)", () => {
    expect(isExclusiveToPremium({ approvedAt: hoursAgo(12), premiumReleasedAt: null }, CONFIG, NOW)).toBe(false);
  });
});

describe("premiumWindowEndsAt", () => {
  it("returns null with no approvedAt", () => {
    expect(premiumWindowEndsAt({ approvedAt: null, premiumReleasedAt: null }, CONFIG)).toBeNull();
  });

  it("returns approvedAt + windowHours", () => {
    const approvedAt = hoursAgo(2);
    const end = premiumWindowEndsAt({ approvedAt, premiumReleasedAt: null }, CONFIG);
    expect(end?.getTime()).toBe(approvedAt.getTime() + 12 * HOUR);
  });
});

describe("nonPremiumVisibilityWhere", () => {
  it("is an empty filter when disabled (everyone sees everything)", () => {
    expect(nonPremiumVisibilityWhere(OFF, NOW)).toEqual({});
  });

  it("restricts to released / capped / never-windowed requests", () => {
    const where = nonPremiumVisibilityWhere(CONFIG, NOW) as {
      OR: Array<Record<string, unknown>>;
    };
    expect(where.OR).toHaveLength(3);
    expect(where.OR).toContainEqual({ premiumReleasedAt: { not: null } });
    expect(where.OR).toContainEqual({ approvedAt: null });
    // hard-cap cutoff is now - windowHours, inclusive (lte) so it matches the
    // exact boundary that isExclusiveToPremium / shouldReleaseNow release at.
    const capClause = where.OR.find(
      (c) => "approvedAt" in c && typeof c.approvedAt === "object" && c.approvedAt && "lte" in (c.approvedAt as object),
    );
    expect((capClause?.approvedAt as { lte: Date }).lte.getTime()).toBe(NOW.getTime() - 12 * HOUR);
  });

  it("is boundary-consistent with isExclusiveToPremium at exactly the cap", () => {
    // At T = approvedAt + windowHours the request must be BOTH non-exclusive and
    // visible to non-PREMIUM brokers (no 1ms gap where it's hidden from all).
    const approvedAt = hoursAgo(12); // exactly the cap relative to NOW
    expect(isExclusiveToPremium({ approvedAt, premiumReleasedAt: null }, CONFIG, NOW)).toBe(false);
    const where = nonPremiumVisibilityWhere(CONFIG, NOW) as { OR: Array<Record<string, unknown>> };
    const cap = where.OR.find((c) => (c.approvedAt as { lte?: Date })?.lte) as { approvedAt: { lte: Date } };
    // approvedAt (== cap cutoff) satisfies the lte clause → visible.
    expect(approvedAt.getTime() <= cap.approvedAt.lte.getTime()).toBe(true);
  });
});

describe("shouldReleaseNow", () => {
  it("never re-releases an already-latched request", () => {
    expect(
      shouldReleaseNow({ approvedAt: hoursAgo(13), premiumReleasedAt: hoursAgo(1) }, 0, CONFIG, NOW),
    ).toBe(false);
  });

  it("releases a windowless (no approvedAt) request", () => {
    expect(shouldReleaseNow({ approvedAt: null, premiumReleasedAt: null }, 0, CONFIG, NOW)).toBe(true);
  });

  it("holds before the valve regardless of low response count", () => {
    expect(shouldReleaseNow({ approvedAt: hoursAgo(3), premiumReleasedAt: null }, 0, CONFIG, NOW)).toBe(false);
  });

  it("valve: releases past valveHours when responses < minResponses", () => {
    expect(shouldReleaseNow({ approvedAt: hoursAgo(7), premiumReleasedAt: null }, 1, CONFIG, NOW)).toBe(true);
  });

  it("valve: holds past valveHours when responses >= minResponses", () => {
    expect(shouldReleaseNow({ approvedAt: hoursAgo(7), premiumReleasedAt: null }, 2, CONFIG, NOW)).toBe(false);
  });

  it("hard cap overrides response count", () => {
    expect(shouldReleaseNow({ approvedAt: hoursAgo(13), premiumReleasedAt: null }, 5, CONFIG, NOW)).toBe(true);
  });

  it("valve boundary: releases exactly at valveHours with too few responses", () => {
    expect(shouldReleaseNow({ approvedAt: hoursAgo(6), premiumReleasedAt: null }, 0, CONFIG, NOW)).toBe(true);
  });

  it("cap boundary: releases exactly at windowHours even with many responses", () => {
    expect(shouldReleaseNow({ approvedAt: hoursAgo(12), premiumReleasedAt: null }, 5, CONFIG, NOW)).toBe(true);
  });
});

describe("getPremiumAccessConfig", () => {
  it("assembles config from system settings", async () => {
    await expect(getPremiumAccessConfig()).resolves.toEqual({
      enabled: true,
      windowHours: 12,
      valveHours: 6,
      minResponses: 2,
    });
  });
});
