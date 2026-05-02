import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import "@/tests/mocks/next-auth";
import { prismaMock } from "@/tests/mocks/prisma";
import { stripeMock } from "@/tests/mocks/stripe";
import {
  setSession,
  borrowerSession,
  brokerSession,
  clearSession,
} from "@/tests/mocks/next-auth";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";
import { makeBroker } from "@/tests/fixtures/users";
import { makeSubscription } from "@/tests/fixtures/requests";

import handler from "@/pages/api/stripe/create-checkout";

describe("POST /api/stripe/create-checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(brokerSession());
  });

  // ─── Method / auth / input gates ────────────────────────────

  it("405s on non-POST", async () => {
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("401s when unauthenticated", async () => {
    clearSession();
    const { req, res } = makeReqRes({ method: "POST", body: { tier: "BASIC" } });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("403s when user is a borrower (not a broker)", async () => {
    setSession(borrowerSession());
    const { req, res } = makeReqRes({ method: "POST", body: { tier: "BASIC" } });
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });

  it.each([
    ["missing tier", { tier: undefined }],
    ["FREE tier (not purchasable)", { tier: "FREE" }],
    ["unknown tier (no mapped priceId)", { tier: "ENTERPRISE" }],
  ])("400s on %s", async (_label, body) => {
    const { req, res } = makeReqRes({ method: "POST", body });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("404s when broker profile doesn't exist", async () => {
    prismaMock.broker.findUnique.mockResolvedValue(null);
    const { req, res } = makeReqRes({ method: "POST", body: { tier: "BASIC" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  // ─── Customer creation (first-time billing) ─────────────────

  it("creates a Stripe customer + persists id when broker has no stripeCustomerId", async () => {
    prismaMock.broker.findUnique.mockResolvedValue({
      ...makeBroker({ stripeCustomerId: null }),
      subscription: null,
    } as never);
    stripeMock.customers.create.mockResolvedValue({ id: "cus_new_1" } as never);
    prismaMock.broker.update.mockResolvedValue(makeBroker({ stripeCustomerId: "cus_new_1" }));
    stripeMock.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/test-session",
    } as never);

    // Default origin (localhost:3000) is in the allowlist; using a foreign
    // origin would now trigger the CSRF gate (correct behavior).
    const { req, res } = makeReqRes({
      method: "POST",
      body: { tier: "BASIC" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(stripeMock.customers.create).toHaveBeenCalledOnce();
    expect(prismaMock.broker.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stripeCustomerId: "cus_new_1" } })
    );
    expect(jsonBody<{ url: string }>(res).url).toContain("checkout.stripe.com");
  });

  it("reuses existing stripeCustomerId — no duplicate customer.create call", async () => {
    prismaMock.broker.findUnique.mockResolvedValue({
      ...makeBroker({ stripeCustomerId: "cus_existing" }),
      subscription: null,
    } as never);
    stripeMock.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/test",
    } as never);

    const { req, res } = makeReqRes({ method: "POST", body: { tier: "BASIC" } });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
    expect(prismaMock.broker.update).not.toHaveBeenCalled();
  });

  it("Checkout session is created with the correct tier priceId + success/cancel URLs", async () => {
    prismaMock.broker.findUnique.mockResolvedValue({
      ...makeBroker({ stripeCustomerId: "cus_1" }),
      subscription: null,
    } as never);
    stripeMock.checkout.sessions.create.mockResolvedValue({ url: "u" } as never);

    const { req, res } = makeReqRes({
      method: "POST",
      body: { tier: "PRO" },
    });
    await handler(req, res);

    const args = stripeMock.checkout.sessions.create.mock.calls[0][0];
    expect(args.mode).toBe("subscription");
    expect(args.line_items).toEqual([{ price: "price_pro_test", quantity: 1 }]);
    // Pinned to NEXTAUTH_URL (was reflecting req.headers.origin — open
    // redirect via attacker-supplied Origin).
    expect(args.success_url).toBe("http://localhost:3000/broker/billing?checkout=success");
    expect(args.cancel_url).toBe("http://localhost:3000/broker/billing");
    expect(args.subscription_data.metadata).toEqual({ brokerId: "broker_1", tier: "PRO" });
  });

  // ─── Upgrade path (existing active subscription) ────────────

  it("BASIC → PRO: immediate upgrade with proration, NO new Checkout session", async () => {
    prismaMock.broker.findUnique.mockResolvedValue({
      ...makeBroker({ stripeCustomerId: "cus_1" }),
      subscription: makeSubscription({
        stripeSubscriptionId: "sub_stripe_1",
        status: "ACTIVE",
      }),
    } as never);
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      items: {
        data: [
          { id: "si_1", price: { id: "price_basic_test" } },
        ],
      },
    } as never);
    stripeMock.subscriptions.update.mockResolvedValue({} as never);

    const { req, res } = makeReqRes({ method: "POST", body: { tier: "PRO" } });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(jsonBody<{ updated: boolean; scheduled: boolean }>(res)).toEqual({
      updated: true,
      scheduled: false,
    });

    const updateArgs = stripeMock.subscriptions.update.mock.calls[0];
    expect(updateArgs[0]).toBe("sub_stripe_1");
    expect(updateArgs[1]).toEqual(
      expect.objectContaining({
        items: [{ id: "si_1", price: "price_pro_test" }],
        proration_behavior: "create_prorations",
      })
    );
    // Must NOT spin up a new Checkout when we're just updating an existing sub.
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("PREMIUM → BASIC (downgrade): stores pendingTier, does NOT call Stripe", async () => {
    prismaMock.broker.findUnique.mockResolvedValue({
      ...makeBroker({ stripeCustomerId: "cus_1", subscriptionTier: "PREMIUM" }),
      subscription: makeSubscription({
        stripeSubscriptionId: "sub_stripe_1",
        status: "ACTIVE",
        tier: "PREMIUM",
        stripePriceId: "price_premium_test",
      }),
    } as never);
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      items: { data: [{ id: "si_1", price: { id: "price_premium_test" } }] },
    } as never);
    prismaMock.subscription.update.mockResolvedValue(makeSubscription({ pendingTier: "BASIC" }));

    const { req, res } = makeReqRes({ method: "POST", body: { tier: "BASIC" } });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(jsonBody<{ updated: boolean; scheduled: boolean }>(res)).toEqual({
      updated: true,
      scheduled: true,
    });

    expect(prismaMock.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { brokerId: "broker_1" },
        data: { pendingTier: "BASIC" },
      })
    );
    // Downgrade MUST NOT hit Stripe immediately — that happens at next invoice cycle.
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });

  it("non-active existing subscription: falls through to Checkout flow (treated as first-time)", async () => {
    prismaMock.broker.findUnique.mockResolvedValue({
      ...makeBroker({ stripeCustomerId: "cus_1" }),
      subscription: makeSubscription({ status: "EXPIRED", stripeSubscriptionId: "sub_old" }),
    } as never);
    stripeMock.checkout.sessions.create.mockResolvedValue({ url: "u" } as never);

    const { req, res } = makeReqRes({ method: "POST", body: { tier: "BASIC" } });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledOnce();
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });
});
