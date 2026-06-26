/**
 * Stripe webhook out-of-order delivery.
 *
 * Stripe makes NO ordering guarantees — in prod you will see:
 *   - subscription.updated before checkout.session.completed
 *   - invoice.paid for a subscription that was already deleted (stale event)
 *   - payment_failed followed by paid (transient decline, retry succeeds)
 *   - events replayed hours later when Stripe retries an earlier 5xx
 *
 * Each of these tests drives one adversarial sequence and asserts the broker
 * + subscription rows land in a defensible final state.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import { prismaMock } from "@/tests/mocks/prisma";
import { stripeMock } from "@/tests/mocks/stripe";
import { makeReqRes } from "@/tests/utils/apiHelpers";
import { makeSubscription } from "@/tests/fixtures/requests";
import { makeBroker } from "@/tests/fixtures/users";
import * as events from "@/tests/fixtures/stripe-events";

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: vi.fn(() => ({ capture: vi.fn() })),
}));
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
  const { req, res } = makeReqRes({
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
  });
  const buf = Buffer.from(JSON.stringify(eventObj));
  setImmediate(() => {
    req.emit("data", buf);
    req.emit("end");
  });
  return { req, res };
}

describe("Stripe webhook — out-of-order delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stripeMock.webhooks.constructEvent.mockReset();
  });

  it("subscription.updated arrives BEFORE checkout.completed → first event no-ops (no sub row yet)", async () => {
    // Stripe can deliver customer.subscription.updated before the original
    // checkout.session.completed that would have created our Subscription row.
    // The handler looks up the subscription by stripeSubscriptionId; if it
    // doesn't exist yet, this MUST be a silent no-op (not a 500).
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: { object: events.subscription({ tier: "BASIC" }) },
    } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(null); // no row yet

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
    expect(prismaMock.broker.update).not.toHaveBeenCalled();
  });

  it("invoice.paid for a subscription that was already DELETED → no credit grant", async () => {
    // Regression guard: a delayed invoice.paid for a cancelled plan must not
    // re-grant credits. The handler finds the Subscription row, but the
    // broker is already downgraded to FREE. We should update status/period
    // but NOT touch broker tier or credits back up.
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "invoice.paid",
      data: { object: events.invoicePaid({ billingReason: "subscription_cycle" }) },
    } as never);
    stripeMock.subscriptions.retrieve.mockResolvedValue(
      events.subscription({ tier: "BASIC" })
    );

    // Subscription was expired via subscription.deleted earlier.
    prismaMock.subscription.findUnique.mockResolvedValue({
      ...makeSubscription({ status: "EXPIRED" }),
      broker: { id: "broker_1" },
    } as never);

    // Pretend the period cursor differs so the idempotency early-return
    // doesn't short-circuit this test (we want to reach the inner tx).
    const stale = new Date(2020, 0, 1);
    prismaMock.subscription.findUnique.mockResolvedValue({
      ...makeSubscription({ status: "EXPIRED", currentPeriodStart: stale }),
      broker: { id: "broker_1" },
    } as never);
    prismaMock.subscription.update.mockResolvedValue(makeSubscription());
    prismaMock.broker.update.mockResolvedValue(makeBroker());

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    // handleInvoicePaid now early-returns on an EXPIRED/CANCELLED subscription,
    // so a replayed/late invoice.paid can NOT resurrect it or re-grant the
    // paid-tier credits to a broker who no longer pays.
    expect(prismaMock.broker.update).not.toHaveBeenCalled();
    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
  });

  it("payment_failed → paid (transient decline recovery): final state is ACTIVE", async () => {
    // Sequence: card declined → retry succeeds. payment_failed now resets
    // credits to FREE (hard-cut, not soft grace period); the successful
    // retry's invoice.paid restores them. Final state: ACTIVE, paid credits.
    const sub = events.subscription({ tier: "BASIC" });

    // 1. payment_failed → status PAST_DUE + credits → FREE in one transaction.
    //    Stripe still reports the sub as past_due (the decline is real).
    stripeMock.webhooks.constructEvent.mockReturnValueOnce({
      type: "invoice.payment_failed",
      data: { object: events.invoicePaid({ billingReason: "subscription_cycle" }) },
    } as never);
    stripeMock.subscriptions.retrieve.mockResolvedValueOnce(
      events.subscription({ status: "past_due" })
    );
    prismaMock.subscription.findUnique.mockResolvedValueOnce({
      ...makeSubscription(),
      broker: { id: "broker_1" },
    } as never);
    prismaMock.$transaction.mockResolvedValueOnce([
      makeSubscription({ status: "PAST_DUE" }),
      { id: "broker_1", responseCredits: 0 },
    ] as never);

    {
      const { req, res } = postWebhook({});
      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    }

    // 2. invoice.paid (retry succeeded)
    vi.clearAllMocks();
    stripeMock.webhooks.constructEvent.mockReturnValueOnce({
      type: "invoice.paid",
      data: { object: events.invoicePaid({ billingReason: "subscription_cycle" }) },
    } as never);
    stripeMock.subscriptions.retrieve.mockResolvedValue(sub);
    prismaMock.subscription.findUnique.mockResolvedValue({
      ...makeSubscription({ status: "PAST_DUE", currentPeriodStart: new Date(2020, 0, 1) }),
      broker: { id: "broker_1" },
    } as never);
    prismaMock.subscription.update.mockResolvedValue(makeSubscription({ status: "ACTIVE" }));
    prismaMock.broker.update.mockResolvedValue(makeBroker({ responseCredits: 5 }));

    {
      const { req, res } = postWebhook({});
      await handler(req, res);
      expect(res.statusCode).toBe(200);
      const updateArgs = prismaMock.subscription.update.mock.calls[0][0];
      expect(updateArgs.data.status).toBe("ACTIVE");
      // Credits restored to tier amount (5 for BASIC)
      expect(prismaMock.broker.update.mock.calls[0][0].data.responseCredits).toBe(5);
    }
  });

  it("same invoice.paid delivered twice → idempotent via period-cursor check", async () => {
    // Stripe retries delivery if we return 5xx. Replaying the exact same event
    // must not grant credits twice. The handler's guard is: if
    // `subscription.currentPeriodStart === incoming period start`, no-op.
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "invoice.paid",
      data: { object: events.invoicePaid({ billingReason: "subscription_cycle" }) },
    } as never);
    const sub = events.subscription({ tier: "BASIC" });
    stripeMock.subscriptions.retrieve.mockResolvedValue(sub);

    // Subscription's currentPeriodStart already matches the incoming event.
    prismaMock.subscription.findUnique.mockResolvedValue({
      ...makeSubscription({
        currentPeriodStart: new Date(1_767_225_600 * 1000),
      }),
      broker: { id: "broker_1" },
    } as never);

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
    expect(prismaMock.broker.update).not.toHaveBeenCalled();
  });

  it("downgrade: subscription.updated with a different priceId re-grants credits for the new tier", async () => {
    // Admin tier change in Stripe dashboard, or a plan change through the
    // customer portal → subscription.updated fires with a new price. The
    // handler should flip broker.subscriptionTier + re-grant credits for
    // the new tier. We downgrade PRO→BASIC here.
    const newSub = events.subscription({
      id: "sub_stripe_1",
      priceId: "price_basic_test", // BASIC = 5 credits (per settings mock)
      tier: "BASIC",
    });
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: { object: newSub },
    } as never);
    prismaMock.subscription.findUnique.mockResolvedValue({
      ...makeSubscription({ tier: "PRO", stripePriceId: "price_pro_test" }),
      broker: { id: "broker_1" },
    } as never);
    prismaMock.subscription.update.mockResolvedValue(makeSubscription({ tier: "BASIC" }));
    prismaMock.broker.update.mockResolvedValue(makeBroker({ subscriptionTier: "BASIC" }));

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const brokerUpdateArgs = prismaMock.broker.update.mock.calls[0][0];
    // INVARIANT: tier change must co-update responseCredits to the new tier's amount.
    expect(brokerUpdateArgs.data).toEqual({
      subscriptionTier: "BASIC",
      responseCredits: 5,
    });
  });

  it("subscription.deleted replayed after broker was already reactivated on a new plan → idempotent", async () => {
    // Unlikely but possible: broker cancelled, resubscribed via new Checkout
    // (new stripeSubscriptionId), and Stripe redelivers the old
    // subscription.deleted event. Since lookup is by stripeSubscriptionId,
    // the old sub row is found; it's already EXPIRED; handler must no-op.
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: { object: events.subscription({ id: "sub_stripe_OLD" }) },
    } as never);
    prismaMock.subscription.findUnique.mockResolvedValue({
      ...makeSubscription({ status: "EXPIRED", stripeSubscriptionId: "sub_stripe_OLD" }),
      broker: { id: "broker_1" },
    } as never);

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    // CRITICAL: must not touch the broker — they're on a fresh plan now.
    expect(prismaMock.broker.update).not.toHaveBeenCalled();
    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
  });

  it("subscription.updated does NOT advance the period cursor — invoice.paid owns it (B2)", async () => {
    // A subscription.updated arriving before invoice.paid at renewal must not
    // move currentPeriodStart; otherwise invoice.paid's period-cursor idempotency
    // check short-circuits and SKIPS the monthly credit refresh, stranding a
    // paying broker at 0 credits for the whole period.
    const renewed = events.subscription({
      priceId: "price_basic_test",
      tier: "BASIC",
      periodStart: 1_769_904_000, // 2026-02-01 — the new period
    });
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: { object: renewed },
    } as never);
    prismaMock.subscription.findUnique.mockResolvedValue({
      ...makeSubscription({ tier: "BASIC", currentPeriodStart: new Date("2026-01-01T00:00:00Z") }),
      broker: { id: "broker_1" },
    } as never);
    prismaMock.subscription.update.mockResolvedValue(makeSubscription());

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const data = prismaMock.subscription.update.mock.calls[0][0].data;
    expect(data.currentPeriodStart).toBeUndefined();
    expect(data.currentPeriodEnd).toBeUndefined();
    // Same tier → no credit re-grant here (that is invoice.paid's job).
    expect(prismaMock.broker.update).not.toHaveBeenCalled();
  });

  it.each([["EXPIRED"], ["CANCELLED"]])(
    "subscription.updated on an already-%s sub is ignored — no resurrection (H3)",
    async (terminalStatus) => {
      stripeMock.webhooks.constructEvent.mockReturnValue({
        type: "customer.subscription.updated",
        data: { object: events.subscription({ status: "active" }) },
      } as never);
      prismaMock.subscription.findUnique.mockResolvedValue({
        ...makeSubscription({ status: terminalStatus as "EXPIRED" | "CANCELLED" }),
        broker: { id: "broker_1" },
      } as never);

      const { req, res } = postWebhook({});
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(prismaMock.subscription.update).not.toHaveBeenCalled();
      expect(prismaMock.broker.update).not.toHaveBeenCalled();
    },
  );

  it("a stale subscription.updated carrying an OLDER period is ignored (H3 recency)", async () => {
    // Redelivered event from a previous period whose price is now outdated:
    // broker downgraded PREMIUM→BASIC at the boundary, then Stripe redelivers an
    // old PREMIUM-price update. It must NOT roll the tier back to PREMIUM /
    // re-grant unlimited credits that are no longer paid for.
    const stale = events.subscription({
      priceId: "price_premium_test",
      tier: "PREMIUM",
      periodStart: 1_767_225_600, // 2026-01-01 — the OLD period
    });
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: { object: stale },
    } as never);
    prismaMock.subscription.findUnique.mockResolvedValue({
      ...makeSubscription({ tier: "BASIC", currentPeriodStart: new Date("2026-02-01T00:00:00Z") }),
      broker: { id: "broker_1" },
    } as never);

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
    expect(prismaMock.broker.update).not.toHaveBeenCalled();
  });

  it.each([
    ["incomplete_expired", "EXPIRED"],
    ["paused", "PAST_DUE"],
  ])("subscription.updated maps Stripe status %s → %s (no lingering paid access)", async (stripeStatus, dbStatus) => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: { object: events.subscription({ status: stripeStatus, tier: "BASIC" }) },
    } as never);
    prismaMock.subscription.findUnique.mockResolvedValue({
      ...makeSubscription({ tier: "BASIC" }),
      broker: { id: "broker_1" },
    } as never);
    prismaMock.subscription.update.mockResolvedValue(makeSubscription());
    prismaMock.broker.update.mockResolvedValue(makeBroker());

    const { req, res } = postWebhook({});
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(prismaMock.subscription.update.mock.calls[0][0].data.status).toBe(dbStatus);
    // Degrade to a non-paying status (no tier change) strips credits to FREE (#7).
    expect(prismaMock.broker.update.mock.calls[0][0].data).toEqual({ responseCredits: 0 });
  });
});
