import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { getPremiumAccessConfig, nonPremiumVisibilityWhere } from "@/lib/premiumAccess";

// Mark every currently-OPEN borrower request as "seen" by this broker.
// Uses BrokerRequestSeen (per-request join table) with composite PK
// enforcing idempotency via skipDuplicates.
// Called when the broker leaves the browse page (blur semantic).
export default withAuth(async (req, res, session) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const broker = await prisma.broker.findUnique({
      where: { userId: session.user.id },
      select: { id: true, subscriptionTier: true },
    });
    if (!broker) {
      return res.status(404).json({ error: "Broker profile not found" });
    }

    // Only mark requests this broker can actually SEE. Without this, a non-
    // PREMIUM broker would silently mark in-window exclusive requests as seen
    // (they're filtered from the feed but still OPEN), losing the "new" dot when
    // those leads later release to them — undercutting the early-access fairness.
    const premiumConfig = await getPremiumAccessConfig();
    const visibilityWhere =
      broker.subscriptionTier === "PREMIUM"
        ? {}
        : nonPremiumVisibilityWhere(premiumConfig, new Date());

    // Find all currently-open requests this broker hasn't seen yet.
    // Narrows the insert set — avoids re-insert attempts for already-seen rows.
    const unseenOpenRequests = await prisma.borrowerRequest.findMany({
      where: {
        status: "OPEN",
        brokerSeens: { none: { brokerId: broker.id } },
        ...visibilityWhere,
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
}, { roles: ["BROKER"] });

