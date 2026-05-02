import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";

// Mark a single borrower request as "seen" for the authenticated broker.
// Idempotent — composite PK (brokerId, requestId) + upsert means repeat
// calls are cheap no-ops. Called when the broker opens a request detail.
export default withAuth(async (req, res, session) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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
}, { roles: ["BROKER"] });

