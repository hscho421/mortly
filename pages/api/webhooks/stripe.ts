import type { NextApiRequest, NextApiResponse } from "next";
import type Stripe from "stripe";
import { getStripe, getTierForPriceId, getPriceIdForTier, getCreditsForTier } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { sendPaymentFailedEmail } from "@/lib/email";
import type { Prisma, SubscriptionTier } from "@prisma/client";

export const config = {
  api: { bodyParser: false },
};

// bodyParser is disabled on this route (raw body needed for signature
// verification), which also removes Next's ~1MB cap. Stripe event payloads are
// tiny, so bound the buffer ourselves — an unauthenticated caller (the URL is
// public; signature is checked only AFTER buffering) could otherwise stream an
// arbitrarily large body and exhaust memory.
const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_WEBHOOK_BODY_BYTES) {
        req.destroy();
        reject(new Error("Webhook body exceeds size limit"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// In Stripe API v2026+, period dates live on the subscription item, not the subscription
function getSubPeriod(stripeSub: Stripe.Subscription): { start: Date; end: Date } | null {
  const item = stripeSub.items.data[0];
  if (!item) return null;
  return {
    start: new Date(item.current_period_start * 1000),
    end: new Date(item.current_period_end * 1000),
  };
}

// In Stripe API v2026+, invoice.subscription moved to invoice.parent.subscription_details
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

// Set a broker's plan tier and the matching credit balance in one place. Credits
// are passed in (each caller already computed them) so no settings read moves
// inside a transaction. Always awaited inside a callback-style $transaction.
//
// H5: for finite tiers we re-apply the broker's STANDING admin bonus on top of
// the monthly tier grant, so a routine renewal/tier-change can't silently wipe an
// audited admin credit adjustment. responseCredits stays the live spendable
// balance (consumption is unchanged); PREMIUM's -1 (unlimited) ignores the bonus.
async function setBrokerPlan(
  client: Prisma.TransactionClient,
  brokerId: string,
  tier: SubscriptionTier,
  credits: number,
) {
  if (credits < 0) {
    return client.broker.update({
      where: { id: brokerId },
      data: { subscriptionTier: tier, responseCredits: credits },
    });
  }
  const broker = await client.broker.findUnique({
    where: { id: brokerId },
    select: { bonusCredits: true },
  });
  // Floor the bonus at apply-time so a stray negative bonus (e.g. an admin
  // removal that under-ran, or a concurrent-grant lost update) can never reduce
  // the monthly grant below the tier amount.
  const bonus = Math.max(0, broker?.bonusCredits ?? 0);
  return client.broker.update({
    where: { id: brokerId },
    data: { subscriptionTier: tier, responseCredits: credits + bonus },
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  const stripe = getStripe();
  const sig = req.headers["stripe-signature"] as string;

  if (!sig) {
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Idempotency ledger — Stripe retries aggressively, and out-of-order
  // delivery is a real production failure mode (we've seen invoice.paid
  // arrive twice within 100ms). A previously completed event short-circuits
  // here. The ledger row is written AFTER the handler succeeds: the previous
  // insert-first design meant a hard crash / lambda timeout mid-handler left
  // the row behind, so Stripe's retry was swallowed as a "duplicate" and the
  // event was lost forever. Every handler below is internally idempotent
  // (in-transaction period/status re-checks), which also covers the tiny
  // check→record race window on concurrent duplicate deliveries.
  const seen = await prisma.processedStripeEvent.findUnique({
    where: { eventId: event.id },
    select: { eventId: true },
  });
  if (seen) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "charge.dispute.created":
        await handleChargeDisputeCreated(event.data.object as Stripe.Dispute);
        break;
      case "customer.deleted":
        await handleCustomerDeleted(event.data.object as Stripe.Customer);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err);
    // No ledger row was written, so Stripe's retry will reprocess cleanly.
    return res.status(500).json({ error: "Webhook handler failed" });
  }

  try {
    await prisma.processedStripeEvent.create({
      data: { eventId: event.id, type: event.type },
    });
  } catch (err) {
    const isDuplicate =
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002";
    if (!isDuplicate) {
      // Failing to RECORD only means a future retry reprocesses an
      // idempotent handler — never fail the delivery over bookkeeping.
      console.error("Webhook ledger insert failed:", err);
    }
  }

  return res.status(200).json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const stripeSubscriptionId = session.subscription as string;
  if (!stripeSubscriptionId) return;

  const stripe = getStripe();
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);

  // Only grant paid access once payment is actually settled — mirrors
  // handleInvoicePaid (250-252). Checkout can complete while the subscription is
  // still incomplete/processing (delayed-notification methods like ACSS/SEPA, or
  // an initial PaymentIntent needing action). For those, invoice.paid promotes
  // the sub once the charge confirms. (no_payment_required covers a 100%-off
  // promo, which Stripe reports as active, so it still grants — intended.)
  if (stripeSub.status !== "active" && stripeSub.status !== "trialing") {
    return;
  }

  const brokerId = stripeSub.metadata.brokerId;
  const priceId = stripeSub.items.data[0]?.price.id;
  const tier = priceId ? getTierForPriceId(priceId) : undefined;
  const period = getSubPeriod(stripeSub);

  // We have an ACTIVE paid subscription but can't map it to a broker/plan
  // (missing metadata, or a price not in STRIPE_PRICE_* — e.g. a price-ID drift
  // between the deploy that created the Checkout and the one processing this
  // event). That is "paid but no service": THROW so the event is NOT recorded as
  // processed, Stripe retries, and it surfaces in logs — instead of silently
  // recording it and leaving the charged broker on FREE forever with no signal.
  if (!brokerId || !priceId || !tier || !period) {
    throw new Error(
      `Cannot provision checkout (paid but unmappable): session=${session.id} ` +
        `sub=${stripeSubscriptionId} brokerId=${brokerId} priceId=${priceId} tier=${tier}`,
    );
  }

  const credits = await getCreditsForTier(tier);

  // Self-heal against duplicate subscriptions (B1/H1). The Subscription row is
  // keyed by brokerId, so the upsert below OVERWRITES stripeSubscriptionId. If
  // our row already points at a DIFFERENT subscription that is still live in
  // Stripe (e.g. a broker started a new Checkout while a PAST_DUE sub was still
  // being dunned, or completed two Checkout tabs), overwriting would orphan the
  // old one — it keeps billing the customer and is invisible to every future
  // webhook (they look it up by the now-replaced id). Cancel it first. Done
  // OUTSIDE the transaction (no network call inside an open DB tx); idempotent
  // because once the row points at the new id this branch no longer fires on a
  // replay. Cleanup failures must never fail the webhook.
  const priorRow = await prisma.subscription.findUnique({
    where: { brokerId },
    select: { stripeSubscriptionId: true },
  });
  if (
    priorRow?.stripeSubscriptionId &&
    priorRow.stripeSubscriptionId !== stripeSubscriptionId
  ) {
    try {
      await stripe.subscriptions.cancel(priorRow.stripeSubscriptionId);
    } catch (err) {
      console.error(
        "Failed to cancel superseded subscription",
        priorRow.stripeSubscriptionId,
        err,
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    // Idempotency: check inside transaction to prevent concurrent duplicate processing
    const existing = await tx.subscription.findUnique({
      where: { brokerId },
    });
    if (
      existing?.stripeSubscriptionId === stripeSubscriptionId &&
      existing?.currentPeriodStart &&
      existing.currentPeriodStart.getTime() === period.start.getTime()
    ) {
      return;
    }

    await tx.subscription.upsert({
      where: { brokerId },
      create: {
        brokerId,
        tier: tier as "BASIC" | "PRO" | "PREMIUM",
        status: "ACTIVE",
        stripeSubscriptionId,
        stripePriceId: priceId,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
      update: {
        tier: tier as "BASIC" | "PRO" | "PREMIUM",
        status: "ACTIVE",
        stripeSubscriptionId,
        stripePriceId: priceId,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        endedAt: null,
        // A fresh checkout must not inherit a downgrade scheduled against a
        // previous (cancelled/expired) subscription.
        pendingTier: null,
      },
    });
    await setBrokerPlan(tx, brokerId, tier as SubscriptionTier, credits);
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Skip first invoice — handled by checkout.session.completed
  if (invoice.billing_reason === "subscription_create") return;

  const stripeSubscriptionId = getInvoiceSubscriptionId(invoice);
  if (!stripeSubscriptionId) {
    // A non-subscription invoice legitimately has no sub id (silent). But a
    // subscription invoice whose id we couldn't extract = a dropped renewal
    // (e.g. a webhook-endpoint payload API-version mismatch) — log it loudly so
    // it isn't silently lost.
    if (invoice.billing_reason?.startsWith("subscription")) {
      console.error("Dropped subscription invoice.paid — no extractable sub id", invoice.id, invoice.billing_reason);
    }
    return;
  }

  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
    include: { broker: { select: { id: true } } },
  });
  if (!subscription) return;

  // A delayed or replayed invoice.paid must not resurrect a subscription that
  // was already cancelled/expired (e.g. Stripe re-delivers an old paid invoice
  // after customer.subscription.deleted landed). Re-activating it here would
  // silently re-grant paid-tier credits to a broker who no longer pays.
  if (subscription.status === "EXPIRED" || subscription.status === "CANCELLED") {
    return;
  }

  const stripe = getStripe();
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const period = getSubPeriod(stripeSub);
  if (!period) return;

  // Stripe is the source of truth for live status: if the subscription is no
  // longer active over there, don't flip our row back to ACTIVE.
  if (stripeSub.status !== "active" && stripeSub.status !== "trialing") {
    return;
  }

  // If there's a pending downgrade, apply it now and swap the Stripe price
  const priceId = stripeSub.items.data[0]?.price.id;
  let tier = getTierForPriceId(priceId) || subscription.tier;

  if (subscription.pendingTier) {
    tier = subscription.pendingTier;
    const newPriceId = getPriceIdForTier(tier);
    // The downgrade's subscription schedule normally swaps the price at the
    // period boundary, so by the time this renewal invoice arrives the price
    // already matches. This direct swap is a fallback for LEGACY pendingTier
    // rows created before the schedule-based downgrade existed. Skip it when the
    // sub is schedule-managed — Stripe rejects a direct price update on those,
    // and the schedule already handles the swap. Never let this fail the renewal
    // (the entitlement swap below is what actually matters).
    if (newPriceId && newPriceId !== priceId && !stripeSub.schedule) {
      const existingItemId = stripeSub.items.data[0]?.id;
      if (existingItemId) {
        try {
          await stripe.subscriptions.update(stripeSubscriptionId, {
            items: [{ id: existingItemId, price: newPriceId }],
            proration_behavior: "none",
          });
        } catch (err) {
          console.error("pendingTier price swap failed (non-fatal):", err);
        }
      }
    }
  }

  const credits = await getCreditsForTier(tier);
  const appliedPriceId = getPriceIdForTier(tier) || priceId;

  await prisma.$transaction(async (tx) => {
    // Idempotency: re-check inside transaction to prevent concurrent duplicate processing
    const current = await tx.subscription.findUnique({
      where: { stripeSubscriptionId },
    });
    if (
      current?.currentPeriodStart &&
      current.currentPeriodStart.getTime() === period.start.getTime()
    ) {
      return;
    }

    await tx.subscription.update({
      where: { stripeSubscriptionId },
      data: {
        status: "ACTIVE",
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        tier: tier as "BASIC" | "PRO" | "PREMIUM",
        stripePriceId: appliedPriceId,
        pendingTier: null,
      },
    });
    await setBrokerPlan(tx, subscription.broker.id, tier as SubscriptionTier, credits);
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const stripeSubscriptionId = getInvoiceSubscriptionId(invoice);
  if (!stripeSubscriptionId) {
    if (invoice.billing_reason?.startsWith("subscription")) {
      console.error("Dropped subscription invoice.payment_failed — no extractable sub id", invoice.id, invoice.billing_reason);
    }
    return;
  }

  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
    include: {
      broker: {
        select: { id: true, user: { select: { id: true, email: true } } },
      },
    },
  });

  if (!subscription) return;

  // Don't demote a subscription that's already terminal in our DB.
  if (subscription.status === "EXPIRED" || subscription.status === "CANCELLED") {
    return;
  }

  // Stripe is the source of truth. A redelivered or out-of-order payment_failed
  // must NOT demote a subscription that has since recovered: e.g. the first
  // delivery 500'd (no ledger row written), the customer fixed their card,
  // invoice.paid restored ACTIVE + credits, and Stripe then re-delivers the
  // original failure (distinct event id → not deduped). Without this guard that
  // stale failure would strip a fully-paid broker to FREE until the next renewal
  // (~a month). Only proceed when Stripe still reports the sub as not-current.
  const stripe = getStripe();
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  if (stripeSub.status === "active" || stripeSub.status === "trialing") {
    return;
  }

  // Strip the broker's paid-tier credits as soon as payment fails — the
  // previous behavior left credits intact through Stripe's full grace
  // period (~3 weeks), so past-due brokers kept messaging clients while
  // their subscription was being non-paid. Reset to FREE immediately.
  // Successful retry → handleInvoicePaid re-grants the paid-tier credits.
  const freeCredits = await getCreditsForTier("FREE");

  await prisma.$transaction([
    prisma.subscription.update({
      where: { stripeSubscriptionId },
      data: { status: "PAST_DUE" },
    }),
    prisma.broker.update({
      where: { id: subscription.broker.id },
      data: { responseCredits: freeCredits },
    }),
  ]);

  // Tell the broker — credits were previously stripped with ZERO
  // notification, leaving them to discover mid-conversation that they
  // couldn't respond to leads. Failures here must never fail the webhook.
  try {
    const brokerUser = subscription.broker.user;
    if (!brokerUser?.email) return; // nothing to notify

    // Per-invoice dedup: Stripe sends multiple payment_failed events per invoice
    // across its dunning window. Insert the in-app notice FIRST (it carries the
    // unique dedupeKey) and only send the EMAIL when that insert actually
    // created a row — otherwise the broker gets a duplicate "payment failed"
    // email on every dunning retry. AdminNotice.adminId is required, so
    // attribute the system notice to the first admin (skip if none exists yet).
    const sysAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    let firstNoticeForInvoice = true;
    if (sysAdmin) {
      try {
        await prisma.adminNotice.create({
          data: {
            adminId: sysAdmin.id,
            userId: brokerUser.id,
            subject: "결제 실패 / Payment failed",
            body:
              "구독 결제가 처리되지 않아 플랜 크레딧이 일시 중지되었습니다. 결제 수단을 업데이트하시면 즉시 복구됩니다. / " +
              "Your subscription payment failed and your plan credits are paused. Update your payment method to restore them.",
            dedupeKey: `payment-failed-${invoice.id}`,
          },
        });
      } catch (err: unknown) {
        const isDuplicate =
          err && typeof err === "object" && "code" in err &&
          (err as { code?: string }).code === "P2002";
        if (!isDuplicate) throw err;
        firstNoticeForInvoice = false; // already notified for this invoice
      }
    }

    if (firstNoticeForInvoice) {
      const billingUrl = `${process.env.NEXTAUTH_URL || "https://mortly.ca"}/broker/billing`;
      await sendPaymentFailedEmail(brokerUser.email, billingUrl);
    }
  } catch (err) {
    console.error("payment-failed notification failed:", err);
  }
}

async function handleSubscriptionUpdated(stripeSub: Stripe.Subscription) {
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSub.id },
    include: { broker: { select: { id: true } } },
  });
  if (!subscription) return;

  // Terminal guard: a cancelled/expired subscription must not be revived by a
  // later (often redelivered / out-of-order) update — mirrors handleInvoicePaid's
  // EXPIRED/CANCELLED bail. A genuine re-subscribe arrives via checkout, not an
  // update, so neither terminal state should be flipped back to ACTIVE here.
  if (subscription.status === "EXPIRED" || subscription.status === "CANCELLED") {
    return;
  }

  const priceId = stripeSub.items.data[0]?.price.id;
  const tier = getTierForPriceId(priceId);
  const period = getSubPeriod(stripeSub);

  // Recency guard: Stripe retries earlier-5xx events hours later, so a stale
  // event can carry an OLD price/period snapshot. Ignore any update whose billing
  // period predates what we've already committed, so a stale event can't roll
  // status/tier/credits back to an outdated snapshot (e.g. revert a real
  // boundary downgrade, re-granting unlimited PREMIUM that is no longer paid for).
  if (
    period &&
    subscription.currentPeriodStart &&
    period.start.getTime() < subscription.currentPeriodStart.getTime()
  ) {
    return;
  }

  const statusMap: Record<string, string> = {
    active: "ACTIVE",
    past_due: "PAST_DUE",
    canceled: "CANCELLED",
    unpaid: "PAST_DUE",
    // A never-confirmed initial payment that timed out, or a paused
    // (pause_collection) sub, must not linger ACTIVE with paid access. The
    // entitlement gates key off subscription.status, so mapping these to a
    // non-ACTIVE status revokes messaging without needing a credit write here.
    incomplete_expired: "EXPIRED",
    paused: "PAST_DUE",
  };
  const mappedStatus = statusMap[stripeSub.status] || subscription.status;

  await prisma.$transaction(async (tx) => {
    // Re-read inside the transaction so the tier comparison is against the
    // committed-at-this-instant DB state, not the snapshot we read above.
    // Without this, two concurrent subscription.updated deliveries can both
    // see `tier !== subscription.tier` and both apply credits.
    const current = await tx.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSub.id },
      select: { tier: true },
    });
    const tierChanged = !!(tier && current && tier !== current.tier);

    await tx.subscription.update({
      where: { stripeSubscriptionId: stripeSub.id },
      data: {
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        status: mappedStatus as "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE",
        ...(tier ? { tier: tier as "BASIC" | "PRO" | "PREMIUM", stripePriceId: priceId } : {}),
        // The billing-period cursor (currentPeriodStart/End) is owned SOLELY by
        // invoice.paid + the initial checkout — subscription.updated must NOT
        // advance it. Advancing it here let a subscription.updated that arrived
        // before invoice.paid at renewal pre-move the cursor, so invoice.paid's
        // idempotency check short-circuited and SKIPPED the monthly credit
        // refresh, leaving a paying broker at 0 credits for the period (B2).
      },
    });

    if (tierChanged && tier) {
      const credits = await getCreditsForTier(tier);
      await setBrokerPlan(tx, subscription.broker.id, tier as SubscriptionTier, credits);
    } else if (mappedStatus === "PAST_DUE" || mappedStatus === "EXPIRED" || mappedStatus === "CANCELLED") {
      // Degraded to a non-paying status without a tier change (e.g. a
      // dashboard/portal status change, or paused/incomplete_expired). The
      // entitlement gate already blocks on status, but strip credits to FREE so
      // the displayed balance stays honest and matches the payment-failed path.
      // Bonus is left intact.
      const freeCredits = await getCreditsForTier("FREE");
      await tx.broker.update({
        where: { id: subscription.broker.id },
        data: { responseCredits: freeCredits },
      });
    }
  });
}

async function handleSubscriptionDeleted(stripeSub: Stripe.Subscription) {
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSub.id },
    include: { broker: { select: { id: true } } },
  });
  if (!subscription) return;
  if (subscription.status === "EXPIRED") return; // idempotent

  const freeCredits = await getCreditsForTier("FREE");

  await prisma.$transaction([
    prisma.subscription.update({
      where: { stripeSubscriptionId: stripeSub.id },
      data: {
        status: "EXPIRED",
        endedAt: new Date(),
        cancelAtPeriodEnd: false,
        // A scheduled downgrade dies with the subscription it was
        // scheduled against.
        pendingTier: null,
      },
    }),
    // Full cancellation → FREE and a clean slate: the standing admin bonus is
    // tied to the paid relationship and does not survive a cancel (a transient
    // payment failure, by contrast, keeps bonusCredits so recovery restores it).
    prisma.broker.update({
      where: { id: subscription.broker.id },
      data: { subscriptionTier: "FREE", responseCredits: freeCredits, bonusCredits: 0 },
    }),
  ]);
}

async function handleChargeDisputeCreated(dispute: Stripe.Dispute) {
  // A chargeback claws the money back, so revoke paid access. The dispute object
  // carries neither the customer nor the subscription. Under the 2026 API the
  // charge NO LONGER exposes an `invoice` back-pointer (verified live: a real
  // dispute's charge has no `invoice` field), so the old charge -> invoice ->
  // subscription mapping silently no-op'd on every real dispute. Map instead via
  // charge -> charge.customer -> broker (stripeCustomerId is 1:1) -> its single
  // subscription (brokerId is 1:1). (We intentionally do NOT handle
  // charge.refunded: a refund is often an admin goodwill gesture that shouldn't
  // auto-revoke an ongoing subscription.) All Stripe reads happen BEFORE the tx.
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
  if (!chargeId) return;

  const stripe = getStripe();
  const charge = await stripe.charges.retrieve(chargeId);
  const customerId =
    typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
  if (!customerId) return; // no customer on the charge — nothing to map to a broker

  const broker = await prisma.broker.findUnique({
    where: { stripeCustomerId: customerId },
    include: { subscription: true },
  });
  if (!broker || !broker.subscription) return; // no broker / no subscription to revoke
  if (broker.subscription.status === "EXPIRED") return; // already terminal

  // Revoke access immediately and reversibly: strip credits to FREE and mark
  // PAST_DUE so the entitlement gate blocks messaging. The standing admin bonus
  // (bonusCredits) is left intact, mirroring the payment-failure path.
  const freeCredits = await getCreditsForTier("FREE");
  await prisma.$transaction([
    prisma.subscription.update({
      where: { brokerId: broker.id },
      data: { status: "PAST_DUE" },
    }),
    prisma.broker.update({
      where: { id: broker.id },
      data: { responseCredits: freeCredits },
    }),
  ]);
}

async function handleCustomerDeleted(customer: Stripe.Customer) {
  // A deleted Stripe customer leaves a stale Broker.stripeCustomerId that would
  // 500 the billing portal / invoices / next upgrade. Clear it and reset the
  // broker to FREE so the next checkout mints a fresh customer.
  const broker = await prisma.broker.findUnique({
    where: { stripeCustomerId: customer.id },
    select: { id: true },
  });
  if (!broker) return;

  const freeCredits = await getCreditsForTier("FREE");
  await prisma.$transaction([
    prisma.broker.update({
      where: { id: broker.id },
      data: {
        stripeCustomerId: null,
        subscriptionTier: "FREE",
        responseCredits: freeCredits,
        bonusCredits: 0,
      },
    }),
    prisma.subscription.updateMany({
      where: { brokerId: broker.id },
      data: { status: "EXPIRED", endedAt: new Date() },
    }),
  ]);
}
