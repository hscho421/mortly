// Next.js runs register() once per server start (incl. each serverless cold
// start). We use it to fail fast on a misconfigured environment instead of
// letting a missing secret surface mid-request — or silently (a missing
// CRON_SECRET 401s every cron with no other signal).
//
// Gated to production so local/test/CI runs aren't blocked. Live-mode Stripe is
// only required for the real production environment (VERCEL_ENV=production), so
// preview deploys may keep using test keys.
import { assertRuntimeEnv } from "@/lib/env";

export async function register() {
  if (process.env.NODE_ENV !== "production") return;
  assertRuntimeEnv(process.env, {
    requireLiveStripe: process.env.VERCEL_ENV === "production",
  });
}
