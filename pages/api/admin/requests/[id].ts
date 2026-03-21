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

  const { id: publicId } = req.query;
  if (!publicId || typeof publicId !== "string") {
    return res.status(400).json({ error: "Invalid request ID" });
  }

  const lookup = /^\d{9}$/.test(publicId)
    ? { publicId }
    : { id: publicId };

  try {
    if (req.method === "GET") {
      const request = await prisma.borrowerRequest.findUnique({
        where: lookup,
        include: {
          borrower: {
            select: { id: true, name: true, email: true, status: true },
          },
          introductions: {
            include: {
              broker: {
                include: {
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            },
            orderBy: { createdAt: "desc" },
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
            select: { introductions: true, conversations: true },
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

      const validStatuses = ["OPEN", "IN_PROGRESS", "CLOSED", "EXPIRED"];
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

      const updated = await prisma.borrowerRequest.update({
        where: { id: request.id },
        data: { status },
      });

      // If closing, also close active conversations
      if (status === "CLOSED") {
        const activeConversations = await prisma.conversation.findMany({
          where: { requestId: request.id, status: "ACTIVE" },
        });

        for (const convo of activeConversations) {
          await prisma.message.create({
            data: {
              conversationId: convo.id,
              senderId: session.user.id,
              body: "[Admin] This request has been closed by an administrator.",
            },
          });

          await prisma.conversation.update({
            where: { id: convo.id },
            data: { status: "CLOSED" },
          });
        }
      }

      // Log the admin action
      await prisma.adminAction.create({
        data: {
          adminId: session.user.id,
          action: status === "CLOSED" ? "CLOSE_REQUEST" : status === "OPEN" ? "REOPEN_REQUEST" : "UPDATE_REQUEST_STATUS",
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

      const conversationIds = conversations.map((c) => c.id);

      if (conversationIds.length > 0) {
        await prisma.message.deleteMany({
          where: { conversationId: { in: conversationIds } },
        });
        await prisma.conversation.deleteMany({
          where: { requestId: request.id },
        });
      }

      await prisma.brokerIntroduction.deleteMany({
        where: { requestId: request.id },
      });

      await prisma.borrowerRequest.delete({
        where: { id: request.id },
      });

      // Log the admin action
      await prisma.adminAction.create({
        data: {
          adminId: session.user.id,
          action: "DELETE_REQUEST",
          targetType: "REQUEST",
          targetId: request.publicId,
          details: JSON.stringify({
            requestType: request.requestType,
            province: request.province,
            borrowerId: request.borrowerId,
          }),
          reason: reason || null,
        },
      });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/admin/requests/[id]:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
