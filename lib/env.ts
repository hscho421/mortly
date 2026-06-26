// Fail-fast environment validation.
//
// Secrets are read with non-null assertions scattered across the app (Stripe,
// NextAuth, cron, Supabase), so a missing var surfaces only when that flow is
// first exercised in prod — or silently (a missing CRON_SECRET just 401s every
// cron). This validates the required set up front so a misconfigured deploy
// fails loudly with a list of exactly what's wrong, and guards against shipping
// Stripe TEST keys to production (checkouts that never charge real cards).
//
// Pure + dependency-free so it can be unit-tested without booting the server.

// Vars the app cannot function without in any deployed environment.
const REQUIRED = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "CRON_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_BASIC",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_PREMIUM",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const STRIPE_PRICE_VARS = ["STRIPE_PRICE_BASIC", "STRIPE_PRICE_PRO", "STRIPE_PRICE_PREMIUM"] as const;

type EnvLike = Record<string, string | undefined>;

/**
 * Returns a list of problems (empty = OK). `requireLiveStripe` should be true
 * only for the real production environment (not preview), where test-mode Stripe
 * keys/price ids must be rejected.
 */
export function validateRuntimeEnv(
  env: EnvLike,
  opts: { requireLiveStripe: boolean },
): string[] {
  const problems: string[] = [];

  for (const key of REQUIRED) {
    if (!env[key] || env[key]!.trim() === "") {
      problems.push(`${key} is missing`);
    }
  }

  if (opts.requireLiveStripe) {
    const sk = env.STRIPE_SECRET_KEY ?? "";
    if (sk && !sk.startsWith("sk_live_")) {
      problems.push(
        "STRIPE_SECRET_KEY is not a live-mode key (expected an sk_live_ prefix) in production",
      );
    }
    if (env.STRIPE_WEBHOOK_SECRET && !env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")) {
      problems.push("STRIPE_WEBHOOK_SECRET does not look like a Stripe webhook secret (whsec_)");
    }
    for (const key of STRIPE_PRICE_VARS) {
      const v = env[key] ?? "";
      if (v && !v.startsWith("price_")) {
        problems.push(`${key} is not a valid Stripe price id (expected a price_ prefix)`);
      }
    }
  }

  return problems;
}

/**
 * Whether the boot validator should enforce live-mode Stripe keys.
 *
 * True only for the real production environment (VERCEL_ENV=production), and NOT
 * when the ALLOW_TEST_STRIPE escape hatch is set. The hatch lets us run the
 * production deploy in Stripe TEST mode for pre-launch smoke testing (no real
 * charges). It MUST be removed (and sk_live_ keys restored) before launch.
 */
export function shouldRequireLiveStripe(env: EnvLike): boolean {
  return env.VERCEL_ENV === "production" && !isTestStripeBypassActive(env);
}

/**
 * True when the production deploy is deliberately running Stripe in TEST mode via
 * the ALLOW_TEST_STRIPE escape hatch. Used to emit a loud boot-time warning so the
 * flag can't be forgotten in place after a pre-launch smoke test.
 */
export function isTestStripeBypassActive(env: EnvLike): boolean {
  return env.VERCEL_ENV === "production" && env.ALLOW_TEST_STRIPE === "1";
}

/**
 * Throws with an aggregated message when the environment is invalid. Called from
 * instrumentation.register() on server boot in production.
 */
export function assertRuntimeEnv(
  env: EnvLike,
  opts: { requireLiveStripe: boolean },
): void {
  const problems = validateRuntimeEnv(env, opts);
  if (problems.length > 0) {
    throw new Error(
      "Environment validation failed — fix these before serving traffic:\n" +
        problems.map((p) => `  - ${p}`).join("\n"),
    );
  }
}
