import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import "@/tests/mocks/next-auth";
import "@/tests/mocks/stripe";
import { prismaMock } from "@/tests/mocks/prisma";
import { stripeMock } from "@/tests/mocks/stripe";
import { setSession, brokerSession, borrowerSession } from "@/tests/mocks/next-auth";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";
import { makeBroker } from "@/tests/fixtures/users";
import { makeSubscription } from "@/tests/fixtures/requests";

import handler from "@/pages/api/stripe/preview-plan-change";

// Broker on BASIC with a live Stripe subscription — the state from which both
// upgrade and downgrade previews are valid.
function basicBroker() {
  return {
    ...makeBroker({ stripeCustomerId: "cus_1", subscriptionTier: "BASIC" }),
    subscription: makeSubscription({
      tier: "BASIC",
      status: "ACTIVE",
      stripeSubscriptionId: "sub_stripe_1",
      currentPeriodEnd: new Date("2026-02-01T00:00:00Z"),
    }),
  };
}

describe("POST /api/stripe/preview-plan-change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(brokerSession());
    prismaMock.broker.findUnique.mockResolvedValue(basicBroker() as never);
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      items: { data: [{ id: "si_1", price: { id: "price_basic_test" } }] },
    } as never);
    // Proration lines net to 2150; the non-proration base-recurring line (6900)
    // must be excluded from the disclosed amount.
    stripeMock.invoices.createPreview.mockResolvedValue({
      currency: "usd",
      total: 9050,
      lines: {
        data: [
          { amount: -1450, parent: { subscription_item_details: { proration: true } } },
          { amount: 3600, parent: { subscription_item_details: { proration: true } } },
          { amount: 6900, parent: { subscription_item_details: { proration: false } } },
        ],
      },
    } as never);
  });

  it("403s a non-broker", async () => {
    setSession(borrowerSession());
    const { req, res } = makeReqRes({ method: "POST", body: { tier: "PRO" } });
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });

  it("405s a non-POST request", async () => {
    const { req, res } = makeReqRes({ method: "GET", body: { tier: "PRO" } });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("400s an invalid tier (FREE / unknown)", async () => {
    const free = makeReqRes({ method: "POST", body: { tier: "FREE" } });
    await handler(free.req, free.res);
    expect(free.res.statusCode).toBe(400);

    const bogus = makeReqRes({ method: "POST", body: { tier: "GOLD" } });
    await handler(bogus.req, bogus.res);
    expect(bogus.res.statusCode).toBe(400);
    expect(stripeMock.invoices.createPreview).not.toHaveBeenCalled();
  });

  it("400s when the broker has no active subscription to change", async () => {
    prismaMock.broker.findUnique.mockResolvedValue({
      ...makeBroker({ stripeCustomerId: "cus_1" }),
      subscription: null,
    } as never);
    const { req, res } = makeReqRes({ method: "POST", body: { tier: "PRO" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(stripeMock.invoices.createPreview).not.toHaveBeenCalled();
  });

  it("400s when target tier equals current tier", async () => {
    const { req, res } = makeReqRes({ method: "POST", body: { tier: "BASIC" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("BASIC → PRO (upgrade): returns the prorated amount from a preview invoice", async () => {
    const { req, res } = makeReqRes({ method: "POST", body: { tier: "PRO" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = jsonBody<{
      scenario: string;
      prorationAmount: number;
      currency: string;
      nextBillDate: string;
    }>(res);
    expect(body.scenario).toBe("upgrade");
    expect(body.prorationAmount).toBe(2150);
    expect(body.currency).toBe("usd");
    // Previews the swap to the new price WITHOUT mutating the subscription.
    expect(stripeMock.invoices.createPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription: "sub_stripe_1",
        subscription_details: expect.objectContaining({
          items: [{ id: "si_1", price: "price_pro_test" }],
          proration_behavior: "create_prorations",
        }),
      }),
    );
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });

  it("PRO → BASIC (downgrade): returns the effective date, no proration / no Stripe preview", async () => {
    prismaMock.broker.findUnique.mockResolvedValue({
      ...makeBroker({ stripeCustomerId: "cus_1", subscriptionTier: "PRO" }),
      subscription: makeSubscription({
        tier: "PRO",
        status: "ACTIVE",
        stripeSubscriptionId: "sub_stripe_1",
        currentPeriodEnd: new Date("2026-02-01T00:00:00Z"),
      }),
    } as never);
    const { req, res } = makeReqRes({ method: "POST", body: { tier: "BASIC" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = jsonBody<{ scenario: string; effectiveDate: string }>(res);
    expect(body.scenario).toBe("downgrade");
    expect(new Date(body.effectiveDate).toISOString()).toBe("2026-02-01T00:00:00.000Z");
    // Downgrades are scheduled at the boundary — no proration preview needed.
    expect(stripeMock.invoices.createPreview).not.toHaveBeenCalled();
  });

  it("500s when Stripe preview throws", async () => {
    stripeMock.invoices.createPreview.mockRejectedValueOnce(new Error("stripe down"));
    const { req, res } = makeReqRes({ method: "POST", body: { tier: "PRO" } });
    await handler(req, res);
    expect(res.statusCode).toBe(500);
  });
});
