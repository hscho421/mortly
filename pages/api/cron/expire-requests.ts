import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { getSettingInt } from "@/lib/settings";

function verifyCronSecret(authHeader: string | undefined): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;
  const token = authHeader.replace("Bearer ", "");
  if (token.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    return false;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyCronSecret(req.headers.authorization)) {
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
