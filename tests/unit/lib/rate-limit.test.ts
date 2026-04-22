import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { authLimiter, verifyCodeLimiter, getClientIp } from "@/lib/rate-limit";

describe("authLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Use a fresh-ish token per test so limiters don't bleed across tests.
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows calls up to the limit then rejects", () => {
    const token = `t-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(authLimiter.check(5, token).success).toBe(true);
    }
    // 6th call in the 60s window should fail.
    expect(authLimiter.check(5, token).success).toBe(false);
  });

  it("resets after the configured interval elapses", () => {
    const token = `t-reset-${Math.random()}`;
    for (let i = 0; i < 5; i++) authLimiter.check(5, token);
    expect(authLimiter.check(5, token).success).toBe(false);

    // Advance 60s — next call should reset.
    vi.advanceTimersByTime(60_001);
    expect(authLimiter.check(5, token).success).toBe(true);
  });

  it("tracks different tokens independently", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    for (let i = 0; i < 5; i++) authLimiter.check(5, a);
    expect(authLimiter.check(5, a).success).toBe(false);
    expect(authLimiter.check(5, b).success).toBe(true);
  });

  it("reports decreasing remaining count", () => {
    const token = `t-remain-${Math.random()}`;
    expect(authLimiter.check(3, token)).toEqual({ success: true, remaining: 2 });
    expect(authLimiter.check(3, token)).toEqual({ success: true, remaining: 1 });
    expect(authLimiter.check(3, token)).toEqual({ success: true, remaining: 0 });
    expect(authLimiter.check(3, token).success).toBe(false);
  });
});

describe("verifyCodeLimiter", () => {
  it("uses a 10-minute window", () => {
    vi.useFakeTimers();
    const token = `vc-${Math.random()}`;
    for (let i = 0; i < 5; i++) verifyCodeLimiter.check(5, token);
    expect(verifyCodeLimiter.check(5, token).success).toBe(false);

    // After 5 min — still blocked.
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(verifyCodeLimiter.check(5, token).success).toBe(false);

    // After 10+1 min — reset.
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(verifyCodeLimiter.check(5, token).success).toBe(true);
    vi.useRealTimers();
  });
});

describe("getClientIp", () => {
  it("extracts the first IP from x-forwarded-for", () => {
    expect(getClientIp({ headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } })).toBe("1.2.3.4");
  });

  it("returns 'unknown' when the header is missing", () => {
    expect(getClientIp({ headers: {} })).toBe("unknown");
  });

  it("returns 'unknown' when the header is an array (Next gives string | string[])", () => {
    expect(getClientIp({ headers: { "x-forwarded-for": ["a", "b"] } })).toBe("unknown");
  });

  it("trims whitespace around the first entry", () => {
    expect(getClientIp({ headers: { "x-forwarded-for": "  9.9.9.9  ,  8.8.8.8" } })).toBe("9.9.9.9");
  });
});
