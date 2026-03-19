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
    return res.status(400).json({ error: "Invalid report ID" });
  }

  try {
    if (req.method === "PUT") {
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: "status is required" });
      }

      const report = await prisma.report.findUnique({
        where: { id },
      });

      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }

      const updated = await prisma.report.update({
        where: { id },
        data: { status },
      });

      return res.status(200).json(updated);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/admin/reports/[id]:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
