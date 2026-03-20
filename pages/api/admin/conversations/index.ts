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
      const conversations = await prisma.conversation.findMany({
        include: {
          borrower: {
            select: { id: true, name: true, email: true, status: true },
          },
          broker: {
            include: {
              user: { select: { id: true, name: true, email: true, status: true } },
            },
          },
          request: {
            select: { id: true, requestType: true, province: true, city: true, status: true },
          },
          _count: { select: { messages: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true, createdAt: true, sender: { select: { name: true } } },
          },
          review: {
            select: { id: true, rating: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      return res.status(200).json(conversations);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/admin/conversations:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
