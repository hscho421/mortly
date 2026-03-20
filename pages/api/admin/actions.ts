import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    if (req.method === "GET") {
      const { action, limit } = req.query;

      const where: Record<string, unknown> = {};
      if (action && action !== "ALL") {
        where.action = action;
      }

      const take = Math.min(parseInt(limit as string, 10) || 50, 200);

      const actions = await prisma.adminAction.findMany({
        where,
        include: {
          admin: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take,
      });

      return res.status(200).json(actions);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/admin/actions:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
