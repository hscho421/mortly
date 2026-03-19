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
      const [users, pendingVerifications, activeRequests, openReports] =
        await Promise.all([
          prisma.user.count(),
          prisma.broker.count({
            where: { verificationStatus: "PENDING" },
          }),
          prisma.borrowerRequest.count({
            where: { status: "OPEN" },
          }),
          prisma.report.count({
            where: { status: "OPEN" },
          }),
        ]);

      return res.status(200).json({
        users,
        pendingVerifications,
        activeRequests,
        openReports,
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/admin/stats:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
