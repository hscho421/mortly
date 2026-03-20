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
      const { search, role } = req.query;

      const where: Record<string, unknown> = {};

      if (role && role !== "ALL") {
        where.role = role;
      }

      if (search && typeof search === "string" && search.trim()) {
        where.OR = [
          { name: { contains: search.trim(), mode: "insensitive" } },
          { email: { contains: search.trim(), mode: "insensitive" } },
          { publicId: { contains: search.trim() } },
        ];
      }

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          publicId: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          broker: {
            select: {
              id: true,
              verificationStatus: true,
              subscriptionTier: true,
              responseCredits: true,
              brokerageName: true,
            },
          },
          _count: {
            select: {
              borrowerRequests: true,
              conversations: true,
              reviews: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json(users);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/admin/users:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
