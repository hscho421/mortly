import { describe, it, expect } from "vitest";
import { validateRuntimeEnv } from "@/lib/env";

const fullEnv: Record<string, string> = {
  DATABASE_URL: "postgres://x",
  NEXTAUTH_SECRET: "s",
  NEXTAUTH_URL: "https://mortly.ca",
  CRON_SECRET: "c",
  STRIPE_SECRET_KEY: "sk_live_abc",
  STRIPE_WEBHOOK_SECRET: "whsec_abc",
  STRIPE_PRICE_BASIC: "price_b",
  STRIPE_PRICE_PRO: "price_p",
  STRIPE_PRICE_PREMIUM: "price_pr",
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "svc",
};

describe("validateRuntimeEnv", () => {
  it("passes a complete live-mode production env", () => {
    expect(validateRuntimeEnv(fullEnv, { requireLiveStripe: true })).toEqual([]);
  });

  it("flags every missing required var", () => {
    const problems = validateRuntimeEnv({}, { requireLiveStripe: false });
    expect(problems).toContain("STRIPE_SECRET_KEY is missing");
    expect(problems).toContain("NEXTAUTH_SECRET is missing");
    expect(problems).toContain("CRON_SECRET is missing");
    expect(problems).toContain("SUPABASE_SERVICE_ROLE_KEY is missing");
    expect(problems.length).toBeGreaterThanOrEqual(12);
  });

  it("treats blank/whitespace as missing", () => {
    const problems = validateRuntimeEnv(
      { ...fullEnv, CRON_SECRET: "   " },
      { requireLiveStripe: false },
    );
    expect(problems).toContain("CRON_SECRET is missing");
  });

  it("rejects Stripe TEST keys when live mode is required (production)", () => {
    const problems = validateRuntimeEnv(
      { ...fullEnv, STRIPE_SECRET_KEY: "sk_test_abc" },
      { requireLiveStripe: true },
    );
    expect(problems.some((p) => p.includes("not a live-mode key"))).toBe(true);
  });

  it("allows Stripe TEST keys when live mode is NOT required (preview)", () => {
    const problems = validateRuntimeEnv(
      { ...fullEnv, STRIPE_SECRET_KEY: "sk_test_abc" },
      { requireLiveStripe: false },
    );
    expect(problems).toEqual([]);
  });

  it("rejects malformed price ids in production", () => {
    const problems = validateRuntimeEnv(
      { ...fullEnv, STRIPE_PRICE_BASIC: "prod_wrong" },
      { requireLiveStripe: true },
    );
    expect(
      problems.some((p) => p.includes("STRIPE_PRICE_BASIC is not a valid Stripe price id")),
    ).toBe(true);
  });
});
