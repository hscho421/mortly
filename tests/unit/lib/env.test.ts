import { describe, it, expect } from "vitest";
import {
  validateRuntimeEnv,
  shouldRequireLiveStripe,
  isTestStripeBypassActive,
} from "@/lib/env";

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

describe("shouldRequireLiveStripe", () => {
  it("requires live keys in production by default", () => {
    expect(shouldRequireLiveStripe({ VERCEL_ENV: "production" })).toBe(true);
  });

  it("does not require live keys for preview deploys", () => {
    expect(shouldRequireLiveStripe({ VERCEL_ENV: "preview" })).toBe(false);
  });

  it("relaxes the live-key check when ALLOW_TEST_STRIPE=1 in production", () => {
    expect(
      shouldRequireLiveStripe({ VERCEL_ENV: "production", ALLOW_TEST_STRIPE: "1" }),
    ).toBe(false);
  });

  it("ignores ALLOW_TEST_STRIPE outside production (preview is already test-mode)", () => {
    expect(
      shouldRequireLiveStripe({ VERCEL_ENV: "preview", ALLOW_TEST_STRIPE: "1" }),
    ).toBe(false);
  });

  it("only honors the exact value '1' for the escape hatch", () => {
    expect(
      shouldRequireLiveStripe({ VERCEL_ENV: "production", ALLOW_TEST_STRIPE: "true" }),
    ).toBe(true);
  });
});

describe("isTestStripeBypassActive", () => {
  it("is active only when production AND the flag is exactly '1'", () => {
    expect(
      isTestStripeBypassActive({ VERCEL_ENV: "production", ALLOW_TEST_STRIPE: "1" }),
    ).toBe(true);
    expect(
      isTestStripeBypassActive({ VERCEL_ENV: "production", ALLOW_TEST_STRIPE: "0" }),
    ).toBe(false);
    expect(isTestStripeBypassActive({ VERCEL_ENV: "production" })).toBe(false);
    expect(
      isTestStripeBypassActive({ VERCEL_ENV: "preview", ALLOW_TEST_STRIPE: "1" }),
    ).toBe(false);
  });

  it("lets the production env otherwise pass validation with test keys", () => {
    const env = { ...fullEnv, STRIPE_SECRET_KEY: "sk_test_abc", VERCEL_ENV: "production", ALLOW_TEST_STRIPE: "1" };
    expect(validateRuntimeEnv(env, { requireLiveStripe: shouldRequireLiveStripe(env) })).toEqual([]);
  });
});
