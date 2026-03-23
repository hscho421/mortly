import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getStripe, getPriceIdForTier, getTierForPriceId } from "@/lib/stripe";

const TIER_RANK: Record<string, number> = { FREE: 0, BASIC: 1, PRO: 2, PREMIUM: 3 };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "BROKER") {
    return res.status(401).json({ error: "Unauthorized" });
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

      if (existingItemId) {
        if (isUpgrade) {
          // Upgrade → immediate with proration
          await stripe.subscriptions.update(
            broker.subscription.stripeSubscriptionId,
            {
              items: [{ id: existingItemId, price: priceId }],
              proration_behavior: "create_prorations",
              metadata: { brokerId: broker.id, tier },
            }
          );
        } else {
          // Downgrade → store pending tier, apply on next billing cycle
          await prisma.subscription.update({
            where: { brokerId: broker.id },
            data: { pendingTier: tier as "BASIC" | "PRO" | "PREMIUM" },
          });
        }
        return res.status(200).json({ updated: true, scheduled: !isUpgrade });
      }
    }

    // No active subscription — create Checkout session
    const origin = req.headers.origin || process.env.NEXTAUTH_URL || "http://localhost:3000";
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
}
