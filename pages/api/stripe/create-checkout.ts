import prisma from "@/lib/prisma";
import { getStripe, getPriceIdForTier, getTierForPriceId } from "@/lib/stripe";
import { withAuth } from "@/lib/withAuth";
import { getSafeRedirectOrigin } from "@/lib/origin";

const TIER_RANK: Record<string, number> = { FREE: 0, BASIC: 1, PRO: 2, PREMIUM: 3 };

export default withAuth(async (req, res, session) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { tier } = req.body;
  if (!tier || tier === "FREE") {
    return res.status(400).json({ error: "Invalid tier" });
  }

  const priceId = getPriceIdForTier(tier);
  if (!priceId) {
    return res.status(400).json({ error: "Invalid tier" });
  }

  try {
    const broker = await prisma.broker.findUnique({
      where: { userId: session.user.id },
      include: { subscription: true },
    });

    if (!broker) {
      return res.status(404).json({ error: "Broker profile not found" });
    }

    const stripe = getStripe();

    // Create Stripe customer if needed
    let stripeCustomerId = broker.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: session.user.email || undefined,
        name: session.user.name || undefined,
        metadata: { brokerId: broker.id, userId: session.user.id },
      });
      stripeCustomerId = customer.id;
      await prisma.broker.update({
        where: { id: broker.id },
        data: { stripeCustomerId },
      });
    }

    // If broker has an active Stripe subscription, update it
    if (
      broker.subscription?.stripeSubscriptionId &&
      broker.subscription.status === "ACTIVE"
    ) {
      const stripeSub = await stripe.subscriptions.retrieve(
        broker.subscription.stripeSubscriptionId
      );
      const existingItemId = stripeSub.items.data[0]?.id;
      const currentPriceId = stripeSub.items.data[0]?.price.id;
      const currentTier = currentPriceId ? getTierForPriceId(currentPriceId) : null;
      const isUpgrade = currentTier
        ? (TIER_RANK[tier] ?? 0) > (TIER_RANK[currentTier] ?? 0)
        : true;

      if (existingItemId && currentPriceId) {
        // A subscription managed by a schedule (from a previously scheduled
        // downgrade) cannot be price-updated directly — Stripe errors. Track
        // the schedule so upgrade/downgrade paths can release/rebuild it.
        const scheduleId =
          typeof stripeSub.schedule === "string"
            ? stripeSub.schedule
            : (stripeSub.schedule?.id ?? null);

        if (currentTier === tier) {
          // Re-selecting the current plan cancels a scheduled downgrade.
          if (broker.subscription.pendingTier) {
            if (scheduleId) await stripe.subscriptionSchedules.release(scheduleId);
            await prisma.subscription.update({
              where: { brokerId: broker.id },
              data: { pendingTier: null },
            });
            return res.status(200).json({ updated: true, cancelled: true });
          }
          return res.status(400).json({ error: "Already on this plan" });
        }

        if (isUpgrade) {
          // Upgrade → immediate with proration. Release any downgrade
          // schedule first (also cancels the pending downgrade — without
          // this, the stale pendingTier silently downgraded the broker at
          // the next renewal).
          if (scheduleId) await stripe.subscriptionSchedules.release(scheduleId);
          await stripe.subscriptions.update(
            broker.subscription.stripeSubscriptionId,
            {
              items: [{ id: existingItemId, price: priceId }],
              proration_behavior: "create_prorations",
              metadata: { brokerId: broker.id, tier },
            }
          );
          if (broker.subscription.pendingTier) {
            await prisma.subscription.update({
              where: { brokerId: broker.id },
              data: { pendingTier: null },
            });
          }
        } else {
          // Downgrade → schedule the price change at the period boundary in
          // Stripe itself. Previously only pendingTier was stored locally, so
          // Stripe billed the renewal at the OLD higher price while
          // invoice.paid granted the NEW lower tier's credits. The schedule
          // makes Stripe generate the renewal invoice at the new price;
          // pendingTier remains the source of truth for the entitlement swap.
          const schedule = scheduleId
            ? await stripe.subscriptionSchedules.retrieve(scheduleId)
            : await stripe.subscriptionSchedules.create({
                from_subscription: broker.subscription.stripeSubscriptionId,
              });
          await stripe.subscriptionSchedules.update(schedule.id, {
            end_behavior: "release",
            phases: [
              {
                items: [{ price: currentPriceId, quantity: 1 }],
                start_date: schedule.phases[0].start_date,
                end_date: schedule.phases[0].end_date,
              },
              {
                items: [{ price: priceId, quantity: 1 }],
                proration_behavior: "none",
              },
            ],
          });
          await prisma.subscription.update({
            where: { brokerId: broker.id },
            data: { pendingTier: tier as "BASIC" | "PRO" | "PREMIUM" },
          });
        }
        return res.status(200).json({ updated: true, scheduled: !isUpgrade });
      }
    }

    // No active subscription — create Checkout session.
    // CRITICAL: never derive `origin` from `req.headers.origin` here. That
    // header is client-controlled — an attacker submitting a forged Origin
    // could redirect post-checkout to a phishing page that mimics our
    // billing screen. `getSafeRedirectOrigin` pins to NEXTAUTH_URL.
    const origin = getSafeRedirectOrigin();
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { brokerId: broker.id, tier },
      },
      success_url: `${origin}/broker/billing?checkout=success`,
      cancel_url: `${origin}/broker/billing`,
      allow_promotion_codes: true,
      payment_method_collection: "if_required",
    });

    return res.status(200).json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
}, { roles: ["BROKER"] });

