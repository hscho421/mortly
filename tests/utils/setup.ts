import { beforeAll, beforeEach, vi } from "vitest";

// Deterministic env for tests. Never use real secrets here.
process.env.NEXTAUTH_SECRET = "test-nextauth-secret-do-not-use-in-prod";
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_dummy";
process.env.STRIPE_PRICE_BASIC = "price_basic_test";
process.env.STRIPE_PRICE_PRO = "price_pro_test";
process.env.STRIPE_PRICE_PREMIUM = "price_premium_test";
process.env.RESEND_API_KEY = "re_test_dummy";
process.env.CRON_SECRET = "cron-test-secret-32-bytes-long-xxxx";
process.env.GOOGLE_CLIENT_ID = "google-test";
process.env.GOOGLE_CLIENT_SECRET = "google-test-secret";

// jsdom-only: testing-library matchers
beforeAll(async () => {
  if (typeof window !== "undefined") {
    await import("@testing-library/jest-dom/vitest");
  }
});

// Silence noisy console in tests but keep errors visible
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  // Keep console.error visible — we want to know if something throws.
});
