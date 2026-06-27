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

vi.mock("@/lib/email", () => ({
  sendPaymentFailedEmail: vi.fn(async () => undefined),
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

  it("renewal re-applies the standing admin bonus on top of the tier grant (H5)", async () => {
    // BASIC (5/mo) broker with a +10 admin bonus: a renewal must restore
    // 5 + 10 = 15, not silently wipe the bonus back to 5.
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "invoice.paid",
      data: { object: events.invoicePaid({ billingReason: "subscription_cycle" }) },
    } as never);
    stripeMock.subscriptions.retrieve.mockResolvedValue(events.subscription({ tier: "BASIC" }));
    prismaMock.subscription.findUnique.mockResolvedValue({
      ...makeSubscription({ status: "ACTIVE", currentPeriodStart: new Date(2020, 0, 1) }),
      broker: { id: "broker_1" },
    } as never);
    prismaMock.subscription.update.mockResolvedValue(makeSubscription());
    // setBrokerPlan reads the broker's standing bonus inside the tx.
    prismaMock.broker.findUnique.mockResolvedValue({ bonusCredits: 10 } as never);
    prismaMock.broker.update.mockResolvedValue(makeBroker());

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(prismaMock.broker.update.mock.calls[0][0].data).toEqual({
      subscriptionTier: "BASIC",
      responseCredits: 15,
    });
  });

  it("checkout.session.completed cancels a superseded DIFFERENT live subscription (no orphan)", async () => {
    // A broker with a PAST_DUE sub (sub_stripe_OLD) completed a fresh Checkout
    // (sub_stripe_NEW). The brokerId-keyed row is about to be overwritten with
    // the new id, so the old sub must be cancelled or it keeps billing the
    // recovered card while being invisible to every future webhook.
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: events.checkoutCompleted({ subscription: "sub_stripe_NEW" }) },
    } as never);
    stripeMock.subscriptions.retrieve.mockResolvedValue(
      events.subscription({ id: "sub_stripe_NEW", tier: "BASIC", priceId: "price_basic_test" })
    );
    stripeMock.subscriptions.cancel.mockResolvedValue({} as never);
    // Existing row points at a DIFFERENT old sub; period differs so the in-tx
    // idempotency check doesn't short-circuit.
    prismaMock.subscription.findUnique.mockResolvedValue({
      ...makeSubscription({ stripeSubscriptionId: "sub_stripe_OLD" }),
      currentPeriodStart: new Date(2020, 0, 1),
    } as never);
    prismaMock.subscription.upsert.mockResolvedValue(makeSubscription());
    prismaMock.broker.update.mockResolvedValue(makeBroker());

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(stripeMock.subscriptions.cancel).toHaveBeenCalledWith("sub_stripe_OLD");
    // The new sub is still provisioned (cancel must not skip the upsert/grant).
    expect(prismaMock.subscription.upsert).toHaveBeenCalled();
    expect(prismaMock.broker.update).toHaveBeenCalled();
  });

  it("checkout.session.completed does NOT cancel when the row already points at the same sub (replay-safe)", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: events.checkoutCompleted({ subscription: "sub_stripe_1" }) },
    } as never);
    stripeMock.subscriptions.retrieve.mockResolvedValue(events.subscription({ id: "sub_stripe_1" }));
    prismaMock.subscription.findUnique.mockResolvedValue({
      ...makeSubscription({ stripeSubscriptionId: "sub_stripe_1" }),
      currentPeriodStart: new Date(2020, 0, 1),
    } as never);
    prismaMock.subscription.upsert.mockResolvedValue(makeSubscription());
    prismaMock.broker.update.mockResolvedValue(makeBroker());

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(stripeMock.subscriptions.cancel).not.toHaveBeenCalled();
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
        // Full cancel → FREE and the standing admin bonus is wiped too.
        data: { subscriptionTier: "FREE", responseCredits: 0, bonusCredits: 0 },
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

  it("invoice.payment_failed marks PAST_DUE AND resets credits to FREE", async () => {
    // Hard-cut on payment failure (was previously a soft "grace period" that
    // let past-due brokers keep messaging for ~3 weeks). Successful retry
    // restores paid-tier credits via invoice.paid.
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "invoice.payment_failed",
      data: { object: events.invoicePaid() },
    } as never);

    prismaMock.subscription.findUnique.mockResolvedValue({
      ...makeSubscription(),
      broker: { id: "broker_1" },
    } as never);
    // Stripe still reports the sub as not-current → the failure is real.
    stripeMock.subscriptions.retrieve.mockResolvedValue(
      events.subscription({ status: "past_due" })
    );
    prismaMock.$transaction.mockResolvedValue([
      makeSubscription({ status: "PAST_DUE" }),
      { id: "broker_1", responseCredits: 0 },
    ] as never);

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    // Both writes happen in the same transaction (status flip + credit reset).
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    // Credits are zeroed but the standing admin bonus is LEFT INTACT, so a
    // successful retry (invoice.paid) restores tierGrant + bonus.
    expect(prismaMock.broker.update.mock.calls[0][0].data).toEqual({ responseCredits: 0 });
  });

  it("invoice.payment_failed is a NO-OP when Stripe reports the sub recovered (active)", async () => {
    // A redelivered / out-of-order payment_failed for a subscription that has
    // since recovered (Smart-Retry succeeded → invoice.paid restored ACTIVE)
    // must NOT demote a paying broker. Stripe is the source of truth.
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "invoice.payment_failed",
      data: { object: events.invoicePaid() },
    } as never);
    prismaMock.subscription.findUnique.mockResolvedValue({
      ...makeSubscription(),
      broker: { id: "broker_1" },
    } as never);
    stripeMock.subscriptions.retrieve.mockResolvedValue(
      events.subscription({ status: "active" })
    );

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
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

  it("checkout.session.completed does NOT grant when the subscription isn't active yet", async () => {
    // Delayed/async payment → checkout completes but the sub is still incomplete;
    // invoice.paid promotes it once the charge settles.
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: events.checkoutCompleted() },
    } as never);
    stripeMock.subscriptions.retrieve.mockResolvedValue(
      events.subscription({ tier: "BASIC", status: "incomplete" })
    );
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
    expect(prismaMock.broker.update).not.toHaveBeenCalled();
  });

  it("charge.dispute.created revokes paid access (PAST_DUE + credits→FREE, bonus kept)", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "charge.dispute.created",
      data: { object: { charge: "ch_1" } },
    } as never);
    // 2026 API: the charge has NO `invoice` back-pointer, so we map the dispute
    // via charge.customer -> broker (stripeCustomerId is 1:1) -> its subscription.
    stripeMock.charges.retrieve.mockResolvedValue({ customer: "cus_1" } as never);
    prismaMock.broker.findUnique.mockResolvedValue({
      id: "broker_1",
      subscription: makeSubscription({ status: "ACTIVE" }),
    } as never);
    prismaMock.$transaction.mockResolvedValue([] as never);

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(prismaMock.broker.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stripeCustomerId: "cus_1" } }),
    );
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    // Subscription flipped PAST_DUE via the 1:1 brokerId selector.
    expect(prismaMock.subscription.update.mock.calls[0][0]).toEqual({
      where: { brokerId: "broker_1" },
      data: { status: "PAST_DUE" },
    });
    // Credits zeroed; the standing admin bonus is left intact.
    expect(prismaMock.broker.update.mock.calls[0][0].data).toEqual({ responseCredits: 0 });
  });

  it("charge.dispute.created on a charge with no customer is a safe no-op", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "charge.dispute.created",
      data: { object: { charge: "ch_1" } },
    } as never);
    stripeMock.charges.retrieve.mockResolvedValue({ customer: null } as never);

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(prismaMock.broker.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("charge.dispute.created on an already-EXPIRED subscription is a no-op", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "charge.dispute.created",
      data: { object: { charge: "ch_1" } },
    } as never);
    stripeMock.charges.retrieve.mockResolvedValue({ customer: "cus_1" } as never);
    prismaMock.broker.findUnique.mockResolvedValue({
      id: "broker_1",
      subscription: makeSubscription({ status: "EXPIRED" }),
    } as never);

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("checkout.session.completed with a paid-but-unmappable price → 500, not silently recorded", async () => {
    // Price not in STRIPE_PRICE_* (env drift). The broker is charged but we can't
    // map a tier: throw so Stripe retries + it's logged, never silently dropped.
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: events.checkoutCompleted() },
    } as never);
    stripeMock.subscriptions.retrieve.mockResolvedValue(
      events.subscription({ status: "active", priceId: "price_NOT_IN_MAP" })
    );

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(prismaMock.processedStripeEvent.create).not.toHaveBeenCalled();
  });

  it("customer.deleted clears stripeCustomerId and resets the broker to FREE", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "customer.deleted",
      data: { object: { id: "cus_gone" } },
    } as never);
    prismaMock.broker.findUnique.mockResolvedValue({ id: "broker_1" } as never);
    prismaMock.$transaction.mockResolvedValue([] as never);

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(prismaMock.broker.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stripeCustomerId: "cus_gone" } })
    );
    expect(prismaMock.broker.update.mock.calls[0][0].data).toMatchObject({
      stripeCustomerId: null,
      subscriptionTier: "FREE",
    });
  });

  it("payment_failed emails only on the FIRST notice per invoice (dunning dedup)", async () => {
    const { sendPaymentFailedEmail } = await import("@/lib/email");
    const emailMock = vi.mocked(sendPaymentFailedEmail);

    const setup = (noticeCreate: () => void) => {
      stripeMock.webhooks.constructEvent.mockReturnValue({
        type: "invoice.payment_failed",
        data: { object: events.invoicePaid() },
      } as never);
      stripeMock.subscriptions.retrieve.mockResolvedValue(
        events.subscription({ status: "past_due" })
      );
      prismaMock.subscription.findUnique.mockResolvedValue({
        ...makeSubscription(),
        broker: { id: "broker_1", user: { id: "user_1", email: "b@test.com" } },
      } as never);
      prismaMock.$transaction.mockResolvedValue([] as never);
      prismaMock.user.findFirst.mockResolvedValue({ id: "admin_1" } as never);
      noticeCreate();
    };

    // 1st delivery: the notice is newly created → email IS sent.
    setup(() => prismaMock.adminNotice.create.mockResolvedValue({} as never));
    {
      const { req, res } = postWebhook({});
      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(emailMock).toHaveBeenCalledOnce();
    }

    // 2nd delivery for the same invoice: notice is a duplicate (P2002) → NO email.
    vi.clearAllMocks();
    setup(() =>
      prismaMock.adminNotice.create.mockRejectedValue(
        Object.assign(new Error("dup"), { code: "P2002" })
      )
    );
    {
      const { req, res } = postWebhook({});
      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(emailMock).not.toHaveBeenCalled();
    }
  });
});
