import prisma from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/withAdmin";

export default withAdmin(async (req, res, session) => {
  const { id: publicId } = req.query;
  if (!publicId || typeof publicId !== "string") {
    return res.status(400).json({ error: "Invalid request ID" });
  }

  const lookup = /^\d{9}$/.test(publicId)
    ? { publicId }
    : { id: publicId };

  if (req.method === "GET") {
    const request = await prisma.borrowerRequest.findUnique({
      where: lookup,
      include: {
        borrower: {
          select: { id: true, name: true, email: true, status: true },
        },
        conversations: {
          include: {
            broker: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
            borrower: {
              select: { id: true, name: true, email: true },
            },
            _count: { select: { messages: true } },
          },
          orderBy: { updatedAt: "desc" },
        },
        _count: {
          select: { conversations: true },
        },
      },
    });

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    return res.status(200).json(request);
  }

  if (req.method === "PUT") {
    const { status, reason } = req.body;

    if (!status) {
      return res.status(400).json({ error: "status is required" });
    }

    const validStatuses = ["PENDING_APPROVAL", "OPEN", "IN_PROGRESS", "CLOSED", "EXPIRED", "REJECTED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const request = await prisma.borrowerRequest.findUnique({
      where: lookup,
    });

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    const previousStatus = request.status;

    // Build update data — handle rejectionReason for REJECTED status
    const updateData: Record<string, unknown> = { status };
    if (status === "REJECTED" && reason) {
      updateData.rejectionReason = reason;
    }
    if (status === "OPEN" && previousStatus === "REJECTED") {
      updateData.rejectionReason = null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedReq = await tx.borrowerRequest.update({
        where: { id: request.id },
        data: updateData,
      });

      if (status === "CLOSED") {
        const activeConversations = await tx.conversation.findMany({
          where: { requestId: request.id, status: "ACTIVE" },
          select: { id: true },
        });

        if (activeConversations.length > 0) {
          for (const convo of activeConversations) {
            await tx.message.create({
              data: {
                conversationId: convo.id,
                senderId: session.user.id,
                body: "[Admin] This request has been closed by an administrator.",
              },
            });
          }

          await tx.conversation.updateMany({
            where: { requestId: request.id, status: "ACTIVE" },
            data: { status: "CLOSED" },
          });
        }
      }

      return updatedReq;
    });

    // Determine the admin action type
    let actionType = "UPDATE_REQUEST_STATUS";
    if (status === "OPEN" && previousStatus === "PENDING_APPROVAL") {
      actionType = "APPROVE_REQUEST";
    } else if (status === "OPEN" && previousStatus === "REJECTED") {
      actionType = "REOPEN_REQUEST";
    } else if (status === "REJECTED") {
      actionType = "REJECT_REQUEST";
    } else if (status === "CLOSED") {
      actionType = "CLOSE_REQUEST";
    } else if (status === "OPEN") {
      actionType = "REOPEN_REQUEST";
    }

    // Log the admin action
    await prisma.adminAction.create({
      data: {
        adminId: session.user.id,
        action: actionType,
        targetType: "REQUEST",
        targetId: request.publicId,
        details: JSON.stringify({ previousStatus, newStatus: status }),
        reason: reason || null,
      },
    });

    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    const { reason } = req.body || {};

    const request = await prisma.borrowerRequest.findUnique({
      where: lookup,
    });

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Delete related data in correct order (respecting foreign keys)
    const conversations = await prisma.conversation.findMany({
      where: { requestId: request.id },
      select: { id: true },
    });

    const conversationIds = conversations.map((c: { id: string }) => c.id);

    await prisma.$transaction(async (tx) => {
      if (conversationIds.length > 0) {
        await tx.message.deleteMany({
          where: { conversationId: { in: conversationIds } },
        });
        await tx.conversation.deleteMany({
          where: { requestId: request.id },
        });
      }
      await tx.borrowerRequest.delete({
        where: { id: request.id },
      });
    });

    // Log the admin action
    await prisma.adminAction.create({
      data: {
        adminId: session.user.id,
        action: "DELETE_REQUEST",
        targetType: "REQUEST",
        targetId: request.publicId,
        details: JSON.stringify({
          mortgageCategory: request.mortgageCategory,
          productTypes: request.productTypes,
          province: request.province,
          borrowerId: request.borrowerId,
        }),
        reason: reason || null,
      },
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
});
