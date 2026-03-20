import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getSettingInt } from "@/lib/settings";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const expiryDays = await getSettingInt("request_expiry_days") || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - expiryDays);

    const result = await prisma.borrowerRequest.updateMany({
      where: {
        status: "OPEN",
        createdAt: {
          lt: cutoff,
        },
      },
      data: {
        status: "EXPIRED",
      },
    });

    return res.status(200).json({
      success: true,
      expiredCount: result.count,
    });
  } catch (error) {
    console.error("Error in /api/cron/expire-requests:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
