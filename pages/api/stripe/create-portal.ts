import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

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

  try {
    const broker = await prisma.broker.findUnique({
      where: { userId: session.user.id },
      select: { stripeCustomerId: true },
    });

    if (!broker?.stripeCustomerId) {
      return res.status(400).json({ error: "No active subscription" });
    }

    const stripe = getStripe();
    const origin = req.headers.origin || process.env.NEXTAUTH_URL || "http://localhost:3000";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: broker.stripeCustomerId,
      return_url: `${origin}/broker/billing`,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (error) {
    console.error("Error creating portal session:", error);
    return res.status(500).json({ error: "Failed to create portal session" });
  }
}
