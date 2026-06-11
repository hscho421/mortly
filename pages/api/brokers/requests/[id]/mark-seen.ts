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
      select: { id: true, verificationStatus: true },
    });
    // Mirror the read gate (requests/[id].ts): only VERIFIED brokers may
    // interact with the marketplace at all.
    if (!broker || broker.verificationStatus !== "VERIFIED") {
      return res.status(403).json({ error: "Broker must be verified" });
    }

    // Brokers navigate by 9-digit publicId (e.g. /broker/requests/123456789),
    // so resolve publicId OR internal id — same as requests/[id].ts. (The old
    // id-only lookup silently 404'd every real call.)
    const lookup = /^\d{9}$/.test(requestId)
      ? { publicId: requestId }
      : { id: requestId };
    const request = await prisma.borrowerRequest.findUnique({
      where: lookup,
      select: { id: true, status: true },
    });
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Mirror the read gate (requests/[id].ts): a broker may mark-seen a request
    // they can actually view — an OPEN marketplace request, OR any request they
    // already have a conversation on. Returning 404 for anything else keeps the
    // existence-oracle + write-IDOR closed.
    if (request.status !== "OPEN") {
      const hasConversation = await prisma.conversation.findFirst({
        where: { requestId: request.id, brokerId: broker.id },
        select: { id: true },
      });
      if (!hasConversation) {
        return res.status(404).json({ error: "Request not found" });
      }
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

