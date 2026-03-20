import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const CREDIT_PACKS = {
  SMALL: { credits: 3, amount: 2900 }, // $29
  LARGE: { credits: 10, amount: 7900 }, // $79
} as const;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (session.user.role !== "BROKER") {
    return res.status(403).json({ error: "Only brokers can purchase credits" });
  }

  try {
    const { packType } = req.body;

    if (!packType || !CREDIT_PACKS[packType as keyof typeof CREDIT_PACKS]) {
      return res.status(400).json({ error: "Invalid pack type. Use SMALL or LARGE." });
    }

    const pack = CREDIT_PACKS[packType as keyof typeof CREDIT_PACKS];

    const broker = await prisma.broker.findUnique({
      where: { userId: session.user.id },
    });

    if (!broker) {
      return res.status(404).json({ error: "Broker profile not found" });
    }

    if (broker.subscriptionTier !== "BASIC" && broker.subscriptionTier !== "PRO") {
      return res.status(403).json({
        error: "Credit packs are only available for Basic and Pro tier brokers.",
      });
    }

    if (broker.responseCredits > 0) {
      return res.status(400).json({
        error: "Credit packs are only available when your credits reach 0.",
      });
    }

    // TODO: Integrate Stripe payment before credit increment
    const [, updatedBroker] = await prisma.$transaction([
      prisma.creditPurchase.create({
        data: {
          brokerId: broker.id,
          packType: packType as "SMALL" | "LARGE",
          credits: pack.credits,
          amount: pack.amount,
        },
      }),
      prisma.broker.update({
        where: { id: broker.id },
        data: { responseCredits: { increment: pack.credits } },
      }),
    ]);

    return res.status(200).json({
      credits: updatedBroker.responseCredits,
      purchased: pack.credits,
    });
  } catch (error) {
    console.error("Error in /api/credits/purchase:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
