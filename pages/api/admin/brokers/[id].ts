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

  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid broker ID" });
  }

  try {
    if (req.method === "PUT") {
      const { verificationStatus } = req.body;

      if (!verificationStatus) {
        return res.status(400).json({ error: "verificationStatus is required" });
      }

      const broker = await prisma.broker.findUnique({
        where: { id },
      });

      if (!broker) {
        return res.status(404).json({ error: "Broker not found" });
      }

      const updated = await prisma.broker.update({
        where: { id },
        data: { verificationStatus },
      });

      return res.status(200).json(updated);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/admin/brokers/[id]:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
