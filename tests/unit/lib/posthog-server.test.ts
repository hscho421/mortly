import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// getPostHogClient caches the client module-level, so reset modules per test.
describe("getPostHogClient", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  it("returns a no-op client that never throws when the token is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
    const { getPostHogClient } = await import("@/lib/posthog-server");

    const client = getPostHogClient();
    // The whole point: constructing + using the client must not throw (a throw
    // here would 500 the Stripe webhook and brick billing). Any method is a no-op.
    expect(() =>
      client.capture({ distinctId: "b1", event: "subscription_renewed" }),
    ).not.toThrow();
    expect(
      client.capture({ distinctId: "b1", event: "x" }) as unknown,
    ).toBeUndefined();
  });

  it("constructs a real client when the token is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_token");
    const { getPostHogClient } = await import("@/lib/posthog-server");
    const client = getPostHogClient();
    expect(typeof client.capture).toBe("function");
    await client.shutdown().catch(() => {});
  });
});
