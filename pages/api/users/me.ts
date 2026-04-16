import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * DELETE /api/users/me
 *
 * Required by Apple App Store guideline 5.1.1(v): in-app account deletion
 * for any app that lets users create an account. Apple rejects apps that
 * only soft-delete or only deactivate.
 *
 * Performs a hard cascade delete in a single transaction:
 *   1. Messages this user sent + Messages in their conversations
 *   2. BrokerRequestSeen rows referencing their broker or their requests
 *   3. Conversations they're a party to (as borrower or broker)
 *   4. BorrowerRequests they own
 *   5. Reports filed against their broker profile
 *   6. Subscription, Broker (if they're a broker)
 *   7. Reports filed BY them
 *   8. AdminNotices received
 *   9. DeviceTokens (cascades automatically — Broker too)
 *  10. The User row itself
 *
 * NOTE: ADMIN users cannot self-delete via this endpoint — admin removal
 * needs manual ops to preserve AdminAction audit trails.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session.user.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        broker: { select: { id: true } },
        borrowerRequests: { select: { id: true } },
        conversations: { select: { id: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role === "ADMIN") {
      return res
        .status(403)
        .json({ error: "Admin accounts cannot self-delete. Contact support." });
    }

    const brokerId = user.broker?.id;
    const requestIds = user.borrowerRequests.map((r) => r.id);

    // Find all conversations the user is part of (as borrower OR as the owning broker)
    const conversationIds = [
      ...user.conversations.map((c) => c.id), // borrower-side
      ...(brokerId
        ? (
            await prisma.conversation.findMany({
              where: { brokerId },
              select: { id: true },
            })
          ).map((c) => c.id)
        : []),
    ];

    await prisma.$transaction(async (tx) => {
      // 1. Messages — anything in their conversations OR sent by them anywhere
      await tx.message.deleteMany({
        where: {
          OR: [
            { conversationId: { in: conversationIds } },
            { senderId: userId },
          ],
        },
      });

      // 2. BrokerRequestSeen — by their broker, or against their requests
      await tx.brokerRequestSeen.deleteMany({
        where: {
          OR: [
            ...(brokerId ? [{ brokerId }] : []),
            ...(requestIds.length > 0 ? [{ requestId: { in: requestIds } }] : []),
          ],
        },
      });

      // 3. Conversations
      if (conversationIds.length > 0) {
        await tx.conversation.deleteMany({
          where: { id: { in: conversationIds } },
        });
      }

      // 4. BorrowerRequests
      if (requestIds.length > 0) {
        await tx.borrowerRequest.deleteMany({
          where: { id: { in: requestIds } },
        });
      }

      // 5. Reports filed against this user's broker profile (targetType="broker")
      if (brokerId) {
        await tx.report.deleteMany({
          where: { targetType: "broker", targetId: brokerId },
        });
      }

      // 6a. Subscription tied to broker
      if (brokerId) {
        await tx.subscription.deleteMany({ where: { brokerId } });
      }

      // 6b. Broker row
      if (brokerId) {
        await tx.broker.delete({ where: { id: brokerId } });
      }

      // 7. Reports filed BY this user
      await tx.report.deleteMany({ where: { reporterId: userId } });

      // 8. AdminNotices received by this user (sent ones are admin-only)
      await tx.adminNotice.deleteMany({ where: { userId } });

      // 9. DeviceTokens — has onDelete: Cascade so this happens automatically
      //    when the user row is deleted, but explicit doesn't hurt and surfaces
      //    failures earlier.
      await tx.deviceToken.deleteMany({ where: { userId } });

      // 10. Finally, the user row
      await tx.user.delete({ where: { id: userId } });
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/users/me:", error);
    return res.status(500).json({
      error: "Failed to delete account. Please contact support.",
    });
  }
}
