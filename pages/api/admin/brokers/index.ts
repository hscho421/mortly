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
      const brokers = await prisma.broker.findMany({
        include: {
          user: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json(brokers);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/admin/brokers:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
