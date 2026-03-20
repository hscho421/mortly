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

  if (req.method === "GET") {
    try {
      const notices = await prisma.adminNotice.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          subject: true,
          body: true,
          read: true,
          createdAt: true,
        },
      });
      return res.status(200).json(notices);
    } catch (error) {
      console.error("Error fetching notices:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method === "PUT") {
    try {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: "Notice id is required" });
      }

      await prisma.adminNotice.updateMany({
        where: { id, userId: session.user.id },
        data: { read: true },
      });

      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("Error marking notice read:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
