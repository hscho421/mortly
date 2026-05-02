import { ReportTargetType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { checkRateLimit } from "@/lib/rate-limit";

export default withAuth(async (req, res, session) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Per-reporter daily cap. The endpoint already de-dupes by
  // (reporter, target) pair, but a malicious reporter can still spray
  // distinct targets to flood moderation queues. 10/day matches our
  // expected legitimate signal-to-noise.
  const dailyLimit = await checkRateLimit({
    key: `reports-${session.user.id}`,
    limit: 10,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!dailyLimit.success) {
    res.setHeader("Retry-After", "86400");
    return res.status(429).json({ error: "Daily report limit reached. Try again tomorrow." });
  }

  try {
    const { targetType, targetId, reason } = req.body;

    if (!targetType || typeof targetType !== "string" ||
        !targetId || typeof targetId !== "string" ||
        !reason || typeof reason !== "string") {
      return res
        .status(400)
        .json({ error: "targetType, targetId, and reason are required" });
    }

    if (targetId.length > 200) {
      return res.status(400).json({ error: "Invalid targetId" });
    }

    const trimmedReason = reason.trim();
    if (trimmedReason.length === 0 || trimmedReason.length > 2000) {
      return res.status(400).json({ error: "Reason must be between 1 and 2000 characters" });
    }

    const allowedTypes: ReportTargetType[] = [
      ReportTargetType.BROKER,
      ReportTargetType.REQUEST,
      ReportTargetType.CONVERSATION,
    ];
    if (!allowedTypes.includes(targetType as ReportTargetType)) {
      return res.status(400).json({ error: "Invalid targetType" });
    }
    const typedTargetType = targetType as ReportTargetType;

    // Prevent duplicate reports from the same user for the same target
    const existing = await prisma.report.findFirst({
      where: {
        reporterId: session.user.id,
        targetType: typedTargetType,
        targetId,
      },
    });

    if (existing) {
      return res.status(409).json({ error: "duplicate" });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: session.user.id,
        targetType: typedTargetType,
        targetId,
        reason: trimmedReason,
      },
    });

    return res.status(201).json(report);
  } catch (error) {
    console.error("Error in /api/reports:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}, { rateLimit: null });
