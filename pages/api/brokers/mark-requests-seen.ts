import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Mark every currently-OPEN borrower request as "seen" by this broker.
// Uses BrokerRequestSeen (per-request join table) with composite PK
// enforcing idempotency via skipDuplicates.
// Called when the broker leaves the browse page (blur semantic).
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
    return res.status(403).json({ error: "Only brokers can mark requests as seen" });
  }

  try {
    const broker = await prisma.broker.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!broker) {
      return res.status(404).json({ error: "Broker profile not found" });
    }

    // Find all currently-open requests this broker hasn't seen yet.
    // Narrows the insert set — avoids re-insert attempts for already-seen rows.
    const unseenOpenRequests = await prisma.borrowerRequest.findMany({
      where: {
        status: "OPEN",
        brokerSeens: { none: { brokerId: broker.id } },
      },
      select: { id: true },
    });

    if (unseenOpenRequests.length === 0) {
      // Update legacy timestamp too, so existing clients still get correct
      // aggregate newCount until they upgrade to the per-card version.
      await prisma.broker.update({
        where: { id: broker.id },
        data: { lastRequestsSeenAt: new Date() } as unknown as Parameters<
          typeof prisma.broker.update
        >[0]["data"],
      });
      return res.status(200).json({ success: true, marked: 0 });
    }

    await prisma.$transaction([
      prisma.brokerRequestSeen.createMany({
        data: unseenOpenRequests.map((r) => ({
          brokerId: broker.id,
          requestId: r.id,
        })),
        skipDuplicates: true,
      }),
      prisma.broker.update({
        where: { id: broker.id },
        data: { lastRequestsSeenAt: new Date() } as unknown as Parameters<
          typeof prisma.broker.update
        >[0]["data"],
      }),
    ]);

    return res
      .status(200)
      .json({ success: true, marked: unseenOpenRequests.length });
  } catch (error) {
    console.error("Error in /api/brokers/mark-requests-seen:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
