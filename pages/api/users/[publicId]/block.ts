import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * POST   /api/users/:publicId/block   — block another user
 * DELETE /api/users/:publicId/block   — unblock
 *
 * Required by Apple App Store guideline 1.2 (UGC apps need both report
 * AND block functionality). When a user blocks another:
 *   - existing conversations between them are filtered out of GET /api/conversations
 *   - new messages POST is rejected
 *   - new conversation POST (broker → borrower) is rejected
 *   - both directions hidden — block is symmetric for visibility
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { publicId } = req.query;
  if (!publicId || typeof publicId !== "string") {
    return res.status(400).json({ error: "publicId is required" });
  }

  const blockerId = session.user.id;

  // Resolve target user from publicId (the wire-safe identifier we expose)
  const target = await prisma.user.findUnique({
    where: { publicId },
    select: { id: true },
  });
  if (!target) {
    return res.status(404).json({ error: "User not found" });
  }
  if (target.id === blockerId) {
    return res.status(400).json({ error: "Cannot block yourself" });
  }

  try {
    if (req.method === "POST") {
      // Idempotent — composite PK + upsert means repeat calls are no-ops
      await prisma.userBlock.upsert({
        where: {
          blockerId_blockedId: {
            blockerId,
            blockedId: target.id,
          },
        },
        update: {},
        create: {
          blockerId,
          blockedId: target.id,
        },
      });
      return res.status(200).json({ success: true, blocked: true });
    }

    if (req.method === "DELETE") {
      await prisma.userBlock.deleteMany({
        where: {
          blockerId,
          blockedId: target.id,
        },
      });
      return res.status(200).json({ success: true, blocked: false });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/users/[publicId]/block:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
