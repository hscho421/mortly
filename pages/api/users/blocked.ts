import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/users/blocked
 * Lists users the authenticated user has blocked. Used to populate the
 * "Blocked Users" management section so users can unblock.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const blocks = await prisma.userBlock.findMany({
      where: { blockerId: session.user.id },
      include: {
        blocked: {
          select: {
            id: true,
            publicId: true,
            name: true,
            email: true,
            broker: { select: { brokerageName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = blocks.map((b) => ({
      publicId: b.blocked.publicId,
      name: b.blocked.name,
      // We expose name + brokerage when available; never email (privacy)
      brokerageName: b.blocked.broker?.brokerageName ?? null,
      blockedAt: b.createdAt,
    }));

    return res.status(200).json({ data });
  } catch (error) {
    console.error("Error in /api/users/blocked:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
