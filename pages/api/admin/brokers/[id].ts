import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";

export default withAdmin(async (req, res, session) => {
  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid broker ID" });
  }

  if (req.method === "GET") {
    // Support lookup by user publicId (9-digit) or broker internal id
    const isPublicId = /^\d{9}$/.test(id);
    const brokerInclude = {
        user: {
          select: { id: true, publicId: true, name: true, email: true, status: true, createdAt: true },
        },
        conversations: {
          include: {
            borrower: { select: { id: true, name: true, email: true } },
            request: { select: { id: true, province: true, mortgageCategory: true, productTypes: true } },
            _count: { select: { messages: true } },
          },
          orderBy: { updatedAt: "desc" as const },
          take: 20,
        },
        subscription: true,
        _count: {
          select: { conversations: true },
        },
    };

    const broker = isPublicId
      ? await prisma.broker.findFirst({
          where: { user: { publicId: id } },
          include: brokerInclude,
        })
      : await prisma.broker.findUnique({
          where: { id },
          include: brokerInclude,
        });

    if (!broker) {
      return res.status(404).json({ error: "Broker not found" });
    }

    return res.status(200).json(broker);
  }

  if (req.method === "PUT") {
    const { verificationStatus, reason } = req.body;

    if (!verificationStatus) {
      return res.status(400).json({ error: "verificationStatus is required" });
    }

    const VALID_STATUSES = ["PENDING", "VERIFIED", "REJECTED"];
    if (!VALID_STATUSES.includes(verificationStatus)) {
      return res.status(400).json({ error: `verificationStatus must be one of: ${VALID_STATUSES.join(", ")}` });
    }

    const broker = await prisma.broker.findUnique({
      where: { id },
      include: { user: { select: { publicId: true } } },
    });

    if (!broker) {
      return res.status(404).json({ error: "Broker not found" });
    }

    // Two-admin gate for VERIFIED: a single admin can RECOMMEND verification
    // (creates a RECOMMEND_VERIFY_BROKER audit row) but the actual VERIFIED
    // flip must be performed by a different admin. Stops a single rogue or
    // compromised admin account from minting fake verified brokers at scale.
    if (verificationStatus === "VERIFIED") {
      const recommendation = await prisma.adminAction.findFirst({
        where: {
          action: "RECOMMEND_VERIFY_BROKER",
          targetType: "BROKER",
          targetId: broker.user.publicId,
          adminId: { not: session.user.id },
        },
        orderBy: { createdAt: "desc" },
      });
      if (!recommendation) {
        // Record THIS admin's recommendation. Another admin can complete the
        // verification by re-PUTing VERIFIED.
        await prisma.adminAction.create({
          data: {
            adminId: session.user.id,
            action: "RECOMMEND_VERIFY_BROKER",
            targetType: "BROKER",
            targetId: broker.user.publicId,
            details: JSON.stringify({
              previousStatus: broker.verificationStatus,
              ...(reason ? { reason } : {}),
            }),
          },
        });
        return res.status(202).json({
          status: "PENDING_SECOND_REVIEW",
          message: "Recommendation recorded. A different admin must complete the verification.",
        });
      }
    }

    const actionMap: Record<string, string> = {
      VERIFIED: "VERIFY_BROKER",
      REJECTED: "REJECT_BROKER",
      PENDING: "RESET_BROKER_VERIFICATION",
    };

    const [updated] = await prisma.$transaction([
      prisma.broker.update({
        where: { id },
        data: { verificationStatus },
      }),
      prisma.adminAction.create({
        data: {
          adminId: session.user.id,
          action: actionMap[verificationStatus] || "UPDATE_BROKER",
          targetType: "BROKER",
          targetId: broker.user.publicId,
          details: JSON.stringify({
            previousStatus: broker.verificationStatus,
            newStatus: verificationStatus,
            ...(reason ? { reason } : {}),
          }),
        },
      }),
    ]);

    return res.status(200).json(updated);
  }

  return res.status(405).json({ error: "Method not allowed" });
});
