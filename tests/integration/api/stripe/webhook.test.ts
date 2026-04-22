import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import { prismaMock } from "@/tests/mocks/prisma";
import { stripeMock } from "@/tests/mocks/stripe";
import { makeReqRes, jsonBody } from "@/tests/utils/apiHelpers";
import { makeSubscription } from "@/tests/fixtures/requests";
import { makeBroker } from "@/tests/fixtures/users";
import * as events from "@/tests/fixtures/stripe-events";

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: vi.fn(() => ({ capture: vi.fn() })),
}));

// Keep the settings lookups deterministic so we can assert the exact credit grants.
vi.mock("@/lib/settings", () => ({
  getSettingInt: vi.fn(async (k: string) => {
    const map: Record<string, number> = {
      free_tier_credits: 0,
      basic_tier_credits: 5,
      pro_tier_credits: 20,
    };
    return map[k] ?? 0;
  }),
  getSettingBool: vi.fn(async () => false),
  getSetting: vi.fn(async () => ""),
  invalidateSettingsCache: vi.fn(),
}));

import handler from "@/pages/api/webhooks/stripe";

function postWebhook(eventObj: object) {
  // bodyParser is disabled on this route. Simulate Node streams by monkey-patching
  // `req.on('data'|'end')` via node-mocks-http events.
  const { req, res } = makeReqRes({
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
  });
  const buf = Buffer.from(JSON.stringify(eventObj));
  // Drive the readable stream interface the handler uses.
  setImmediate(() => {
    req.emit("data", buf);
    req.emit("end");
  });
  return { req, res };
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stripeMock.webhooks.constructEvent.mockReset();
  });

  it("405s on non-POST", async () => {
    const { req, res } = makeReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("400s on missing stripe-signature header", async () => {
    const { req, res } = makeReqRes({ method: "POST" });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s when Stripe rejects the signature", async () => {
    stripeMock.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    const { req, res } = postWebhook({});
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("checkout.session.completed grants credits for the tier", async () => {
    const sub = events.subscription({ tier: "BASIC", priceId: "price_basic_test" });
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: events.checkoutCompleted() },
    } as never);
    stripeMock.subscriptions.retrieve.mockResolvedValue(sub);

    // Inside tx: not yet processed.
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.subscription.upsert.mockResolvedValue(makeSubscription());
    prismaMock.broker.update.mockResolvedValue(makeBroker({ responseCredits: 5 }));

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const brokerUpdateArgs = prismaMock.broker.update.mock.calls[0][0];
    expect(brokerUpdateArgs.data).toEqual({
      subscriptionTier: "BASIC",
      responseCredits: 5,
    });
  });

  it("checkout.session.completed is idempotent — repeat with same period = no-op", async () => {
    const sub = events.subscription({ tier: "BASIC" });
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: events.checkoutCompleted() },
    } as never);
    stripeMock.subscriptions.retrieve.mockResolvedValue(sub);

    prismaMock.subscription.findUnique.mockResolvedValue({
      ...makeSubscription(),
      stripeSubscriptionId: "sub_stripe_1",
      currentPeriodStart: new Date(1_767_225_600 * 1000), // matches fixture
    });

    const { req, res } = postWebhook({});
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
    expect(prismaMock.broker.update).not.toHaveBeenCalled();
  });

  it("PREMIUM tier grants -1 (unlimited) credits", async () => {
    const sub = events.subscription({ tier: "PREMIUM", priceId: "price_premium_test" });
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: events.checkoutCompleted() },
    } as never);
    stripeMock.subscriptions.retrieve.mockResolvedValue(sub);
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.subscription.upsert.mockResolvedValue(makeSubscription({ tier: "PREMIUM" }));
    prismaMock.broker.update.mockResolvedValue(makeBroker());

    const { req, res } = postWebhook({});
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const data = prismaMock.broker.update.mock.calls[0][0].data;
    expect(data.responseCredits).toBe(-1);
  });

  it("invoice.paid skips first-invoice (subscription_create) — delegates to checkout handler", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "invoice.paid",
      data: { object: events.invoicePaid({ billingReason: "subscription_create" }) },
    } as never);

    const { req, res } = postWebhook({});
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it("customer.subscription.deleted downgrades broker to FREE + resets credits", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: { object: events.subscription() },
    } as never);

    prismaMock.subscription.findUnique.mockResolvedValue({
      ...makeSubscription(),
      broker: { id: "broker_1" },
    } as never);
    prismaMock.subscription.update.mockResolvedValue(makeSubscription({ status: "EXPIRED" }));
    prismaMock.broker.update.mockResolvedValue(
      makeBroker({ subscriptionTier: "FREE", responseCredits: 0 })
    );

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    // Transaction was invoked with an array — our mock runs it via Promise.all.
    expect(prismaMock.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "EXPIRED" }) })
    );
    expect(prismaMock.broker.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { subscriptionTier: "FREE", responseCredits: 0 },
      })
    );
  });

  it("customer.subscription.deleted is idempotent when already EXPIRED", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: { object: events.subscription() },
    } as never);
    prismaMock.subscription.findUnique.mockResolvedValue({
      ...makeSubscription({ status: "EXPIRED" }),
      broker: { id: "broker_1" },
    } as never);

    const { req, res } = postWebhook({});
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
    expect(prismaMock.broker.update).not.toHaveBeenCalled();
  });

  it("invoice.payment_failed marks PAST_DUE (does not revoke access)", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "invoice.payment_failed",
      data: { object: events.invoicePaid() },
    } as never);

    prismaMock.subscription.findUnique.mockResolvedValue({
      ...makeSubscription(),
      broker: { id: "broker_1" },
    } as never);
    prismaMock.subscription.update.mockResolvedValue(makeSubscription({ status: "PAST_DUE" }));

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const updateArgs = prismaMock.subscription.update.mock.calls[0][0];
    expect(updateArgs.data).toEqual({ status: "PAST_DUE" });
    // Credits must NOT be wiped on a soft failure — grace period.
    expect(prismaMock.broker.update).not.toHaveBeenCalled();
  });

  it("returns 200 for event types we don't handle (don't break the webhook)", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "customer.created",
      data: { object: {} },
    } as never);

    const { req, res } = postWebhook({});
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(jsonBody<{ received: boolean }>(res).received).toBe(true);
  });
});
