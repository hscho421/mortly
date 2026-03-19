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

  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid request ID" });
  }

  try {
    if (req.method === "GET") {
      const request = await prisma.borrowerRequest.findUnique({
        where: { id },
        include: {
          _count: {
            select: { introductions: true },
          },
          introductions: {
            include: {
              broker: { include: { user: true } },
            },
          },
        },
      });

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (session.user.role === "BORROWER" && request.borrowerId !== session.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (session.user.role === "BROKER" && request.status !== "OPEN") {
        const hasResponded = request.introductions.some(
          (intro: { broker: { userId: string } }) => intro.broker.userId === session.user.id
        );
        if (!hasResponded) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      return res.status(200).json(request);
    }

    if (req.method === "PUT") {
      const request = await prisma.borrowerRequest.findUnique({
        where: { id },
      });

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (request.borrowerId !== session.user.id) {
        return res.status(403).json({ error: "Only the owning borrower can update this request" });
      }

      const { status } = req.body;

      const updated = await prisma.borrowerRequest.update({
        where: { id },
        data: { status },
      });

      if (status === "CLOSED") {
        const activeConversations = await prisma.conversation.findMany({
          where: { requestId: id, status: "ACTIVE" },
        });

        for (const convo of activeConversations) {
          await prisma.message.create({
            data: {
              conversationId: convo.id,
              senderId: session.user.id,
              body: "This request has been closed by the borrower. Thank you for your interest.",
            },
          });

          await prisma.conversation.update({
            where: { id: convo.id },
            data: { status: "CLOSED" },
          });
        }
      }

      return res.status(200).json(updated);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/requests/[id]:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
