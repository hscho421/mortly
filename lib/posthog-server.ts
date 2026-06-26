import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

// A no-op stand-in used when the project token is absent. CRITICAL: the real
// `new PostHog(undefined)` THROWS ("You must pass your PostHog project's api
// key."), and getPostHogClient is called (un-awaited, post-DB-commit) by every
// Stripe webhook handler — so a missing token used to throw past the handler's
// catch, return 500, skip the idempotency-ledger write, and make Stripe retry
// the (already-committed) event forever until it disabled the endpoint, dropping
// all future billing webhooks. Returning a no-op keeps analytics optional and
// can never brick billing. The Proxy makes ANY method (capture/flush/…) a safe
// no-op so future callers can't trip on it either.
const NOOP_CLIENT = new Proxy(
  {},
  { get: () => () => undefined },
) as unknown as PostHog;

export function getPostHogClient(): PostHog {
  if (posthogClient) return posthogClient;

  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) {
    console.warn(
      "[posthog-server] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN missing — server analytics disabled (no-op).",
    );
    posthogClient = NOOP_CLIENT;
    return posthogClient;
  }

  posthogClient = new PostHog(token, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
  return posthogClient;
}
