import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { withAuth } from "@/lib/withAuth";
import { getSafeRedirectOrigin } from "@/lib/origin";

export default withAuth(async (req, res, session) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const broker = await prisma.broker.findUnique({
      where: { userId: session.user.id },
      select: { stripeCustomerId: true },
    });

    if (!broker?.stripeCustomerId) {
      return res.status(400).json({ error: "No active subscription" });
    }

    const stripe = getStripe();
    // Pin return_url to a server-allowlisted origin — never reflect
    // req.headers.origin into a Stripe redirect URL.
    const origin = getSafeRedirectOrigin();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: broker.stripeCustomerId,
      return_url: `${origin}/broker/billing`,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (error) {
    console.error("Error creating portal session:", error);
    return res.status(500).json({ error: "Failed to create portal session" });
  }
}, { roles: ["BROKER"] });
