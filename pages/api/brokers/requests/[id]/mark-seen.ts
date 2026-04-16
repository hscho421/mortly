import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Mark a single borrower request as "seen" for the authenticated broker.
// Idempotent — composite PK (brokerId, requestId) + upsert means repeat
// calls are cheap no-ops. Called when the broker opens a request detail.
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

  const { id: requestId } = req.query;
  if (!requestId || typeof requestId !== "string") {
    return res.status(400).json({ error: "Request id is required" });
  }

  try {
    const broker = await prisma.broker.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!broker) {
      return res.status(404).json({ error: "Broker profile not found" });
    }

    // Confirm the request exists before creating a seen row
    // (avoids dangling records for bad ids).
    const request = await prisma.borrowerRequest.findUnique({
      where: { id: requestId },
      select: { id: true },
    });
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    await prisma.brokerRequestSeen.upsert({
      where: {
        brokerId_requestId: {
          brokerId: broker.id,
          requestId: request.id,
        },
      },
      update: {}, // already seen — leave seenAt as-is (first view timestamp)
      create: {
        brokerId: broker.id,
        requestId: request.id,
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in /api/brokers/requests/[id]/mark-seen:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
