import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getSettingInt } from "@/lib/settings";
import { verifyCronRequest } from "@/lib/cron";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Accept GET (Vercel cron's only method) and POST (manual runs).
  // Auth gate requires Authorization: Bearer + x-vercel-cron, neither of
  // which a browser can forge via image preload.
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyCronRequest(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const expiryDays = await getSettingInt("request_expiry_days") || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - expiryDays);

    const result = await prisma.borrowerRequest.updateMany({
      where: {
        status: { in: ["OPEN", "PENDING_APPROVAL"] },
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
