import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";

/**
 * GET /api/users/blocked
 * Lists users the authenticated user has blocked. Used to populate the
 * "Blocked Users" management section so users can unblock.
 */
export default withAuth(async (req, res, session) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
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
});

