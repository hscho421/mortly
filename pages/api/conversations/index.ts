import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateConversationPublicId } from "@/lib/publicId";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (req.method === "GET") {
      const where: Record<string, unknown> = {};

      if (session.user.role === "BORROWER") {
        where.borrowerId = session.user.id;
      } else if (session.user.role === "BROKER") {
        const broker = await prisma.broker.findUnique({
          where: { userId: session.user.id },
        });
        if (!broker) {
          return res.status(404).json({ error: "Broker profile not found" });
        }
        where.brokerId = broker.id;
      } else {
        return res.status(403).json({ error: "Forbidden" });
      }

      const conversations = await prisma.conversation.findMany({
        where,
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          broker: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          borrower: {
            select: { id: true, name: true, email: true },
          },
          request: true,
        },
        orderBy: { updatedAt: "desc" },
      });

      return res.status(200).json(conversations);
    }

    if (req.method === "POST") {
      if (session.user.role !== "BORROWER") {
        return res.status(403).json({ error: "Only borrowers can create conversations" });
      }

      const { requestId, brokerId } = req.body;

      if (!requestId || !brokerId) {
        return res.status(400).json({ error: "requestId and brokerId are required" });
      }

      // Resolve publicId to internal id
      const reqLookup = /^\d{9}$/.test(requestId)
        ? { publicId: requestId }
        : { id: requestId };
      const request = await prisma.borrowerRequest.findUnique({
        where: reqLookup,
      });

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (request.borrowerId !== session.user.id) {
        return res.status(403).json({ error: "You can only create conversations for your own requests" });
      }

      // Check for existing conversation to prevent duplicates
      const existing = await prisma.conversation.findFirst({
        where: { requestId: request.id, brokerId },
      });

      if (existing) {
        return res.status(200).json(existing);
      }

      const convoPublicId = await generateConversationPublicId();
      const conversation = await prisma.conversation.create({
        data: {
          publicId: convoPublicId,
          requestId: request.id,
          borrowerId: session.user.id,
          brokerId,
        },
      });

      return res.status(201).json(conversation);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/conversations:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
