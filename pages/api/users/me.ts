import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { encode } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * DELETE /api/users/me — in-app account deletion (App Store 5.1.1(v)).
 * PATCH  /api/users/me — update profile fields (currently: name).
 *
 * DELETE performs a hard cascade delete; PATCH is a targeted field update
 * used by the post-OAuth name-entry screen when Apple didn't return fullName.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "PATCH") {
    return handlePatch(req, res);
  }
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

async function handlePatch(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "Server auth not configured" });
  }

  const rawName = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!rawName) {
    return res.status(400).json({ error: "Name is required" });
  }
  if (rawName.length > 100) {
    return res.status(400).json({ error: "Name must be 100 characters or fewer" });
  }

  const userId = session.user.id;
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, publicId: true, email: true, role: true, preferences: true },
  });
  if (!existing) {
    return res.status(404).json({ error: "User not found" });
  }

  // Clear needsNameEntry from preferences; preserve other prefs.
  const prefs = (existing.preferences as Record<string, unknown>) || {};
  const restPrefs = { ...prefs };
  delete restPrefs.needsNameEntry;
  const newPrefs = Object.keys(restPrefs).length > 0 ? restPrefs : null;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: rawName,
      preferences: newPrefs ? JSON.parse(JSON.stringify(newPrefs)) : null,
    },
    select: { id: true, publicId: true, email: true, name: true, role: true, preferences: true },
  });

  const updatedPrefs = (updated.preferences as Record<string, unknown> | null) ?? {};
  const needsRoleSelection = updatedPrefs.needsRoleSelection === true;

  // Re-encode the JWT so the client's next getSession() sees the updated
  // name and cleared needsNameEntry (same pattern as select-role).
  const sessionToken = await encode({
    token: {
      id: updated.id,
      publicId: updated.publicId,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      needsRoleSelection,
      needsNameEntry: false,
    },
    secret,
    maxAge: SESSION_MAX_AGE,
  });

  return res.status(200).json({
    success: true,
    sessionToken,
    user: {
      id: updated.id,
      publicId: updated.publicId,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      needsRoleSelection,
      needsNameEntry: false,
    },
  });
}
