// Next.js runs register() once per server start (incl. each serverless cold
// start). We use it to fail fast on a misconfigured environment instead of
// letting a missing secret surface mid-request — or silently (a missing
// CRON_SECRET 401s every cron with no other signal).
//
// Gated to production so local/test/CI runs aren't blocked. Live-mode Stripe is
// only required for the real production environment (VERCEL_ENV=production), so
// preview deploys may keep using test keys. The ALLOW_TEST_STRIPE escape hatch
// (see lib/env.ts) also lets production run in Stripe TEST mode for pre-launch
// smoke testing — it warns loudly on every boot and must be removed before launch.
import { assertRuntimeEnv, shouldRequireLiveStripe, isTestStripeBypassActive } from "@/lib/env";

export async function register() {
  if (process.env.NODE_ENV !== "production") return;

  if (isTestStripeBypassActive(process.env)) {
    console.warn(
      "\n⚠️  ALLOW_TEST_STRIPE=1 — PRODUCTION is running in Stripe TEST mode.\n" +
        "   No real cards will be charged. Remove this flag and restore sk_live_ keys before launch.\n",
    );
  }

  assertRuntimeEnv(process.env, {
    requireLiveStripe: shouldRequireLiveStripe(process.env),
  });
}
