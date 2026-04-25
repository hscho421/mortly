import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";

export default withAdmin(async (req, res, session) => {
  if (req.method === "POST") {
    const { brokerId, amount, reason } = req.body;

    if (!brokerId || typeof brokerId !== "string") {
      return res.status(400).json({ error: "brokerId is required" });
    }

    if (typeof amount !== "number" || amount === 0) {
      return res.status(400).json({ error: "amount must be a non-zero number" });
    }

    const broker = await prisma.broker.findUnique({
      where: { id: brokerId },
      include: { user: { select: { publicId: true, name: true, email: true } } },
    });

    if (!broker) {
      return res.status(404).json({ error: "Broker not found" });
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
        data: { responseCredits: { increment: amount } },
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
