import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";

export default withAdmin(async (req, res, session) => {
  if (req.method === "POST") {
    const { brokerId, amount, reason } = req.body;

    if (!brokerId || typeof brokerId !== "string") {
      return res.status(400).json({ error: "brokerId is required" });
    }

    if (typeof amount !== "number" || !Number.isInteger(amount) || amount === 0) {
      return res.status(400).json({ error: "amount must be a non-zero integer" });
    }
    // Hard cap: no single admin action can change a balance by more than
    // 10,000. Larger adjustments must be done in multiple deliberate steps
    // (and each one is audited). Defends against fat-finger and rogue-admin
    // worst case.
    if (Math.abs(amount) > 10_000) {
      return res.status(400).json({ error: "amount must be between -10000 and 10000" });
    }

    const broker = await prisma.broker.findUnique({
      where: { id: brokerId },
      include: { user: { select: { publicId: true, name: true, email: true } } },
    });

    if (!broker) {
      return res.status(404).json({ error: "Broker not found" });
    }

    // PREMIUM stores responseCredits = -1 (unlimited sentinel). Arithmetic on it
    // (e.g. +50 → 49) would silently break unlimited and strand a bonus that
    // resurfaces on a later downgrade. Credit adjustments don't apply to an
    // unlimited plan, so reject them outright.
    if (broker.responseCredits < 0) {
      return res.status(400).json({
        error: "This broker is on an unlimited (PREMIUM) plan; credit adjustments don't apply.",
        code: "UNLIMITED_PLAN",
      });
    }

    if (amount < 0 && broker.responseCredits + amount < 0) {
      return res.status(400).json({
        error: `Cannot remove ${Math.abs(amount)} credits. Broker only has ${broker.responseCredits}.`,
      });
    }

    const previousBalance = broker.responseCredits;

    const [updated] = await prisma.$transaction([
      prisma.broker.update({
        where: { id: brokerId },
        // Adjust BOTH the live balance and the standing bonus atomically (both via
        // increment, so two concurrent admin grants can't desync the fields) so
        // the grant takes effect now AND survives the next renewal (renewals
        // re-apply bonusCredits on top of the tier grant). A negative bonus is
        // floored to 0 at apply-time in setBrokerPlan.
        data: {
          responseCredits: { increment: amount },
          bonusCredits: { increment: amount },
        },
        select: {
          id: true,
          responseCredits: true,
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.adminAction.create({
        data: {
          adminId: session.user.id,
          action: "CREDIT_ADJUST",
          targetType: "BROKER",
          targetId: broker.user.publicId,
          details: JSON.stringify({
            amount,
            previousBalance,
            newBalance: previousBalance + amount,
          }),
          reason: reason || null,
        },
      }),
    ]);

    return res.status(200).json(updated);
  }

  return res.status(405).json({ error: "Method not allowed" });
});
