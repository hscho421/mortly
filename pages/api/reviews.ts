import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.method === "POST") {
    try {
      const { conversationId, rating, comment } = req.body;

      if (!conversationId || !rating) {
        return res.status(400).json({ message: "Conversation ID and rating are required" });
      }

      if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        return res.status(400).json({ message: "Rating must be an integer between 1 and 5" });
      }

      // Get conversation and verify ownership
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { broker: true },
      });

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      if (conversation.borrowerId !== session.user.id) {
        return res.status(403).json({ message: "Only the borrower can leave a review" });
      }

      if (conversation.status !== "CLOSED") {
        return res.status(400).json({ message: "Conversation must be closed before leaving a review" });
      }

      // Check if review already exists
      const existing = await prisma.review.findUnique({
        where: { conversationId_borrowerId: { conversationId, borrowerId: session.user.id } },
      });

      if (existing) {
        return res.status(409).json({ message: "You have already reviewed this conversation" });
      }

      // Create review
      const review = await prisma.review.create({
        data: {
          rating,
          comment: comment?.trim() || null,
          brokerId: conversation.brokerId,
          borrowerId: session.user.id,
          conversationId,
        },
      });

      // Recalculate broker average rating
      const { _avg, _count } = await prisma.review.aggregate({
        where: { brokerId: conversation.brokerId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await prisma.broker.update({
        where: { id: conversation.brokerId },
        data: {
          rating: _avg.rating ? Math.round(_avg.rating * 10) / 10 : null,
          completedMatches: _count.rating,
        },
      });

      return res.status(201).json(review);
    } catch (error) {
      console.error("Create review error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  // GET reviews for a broker
  if (req.method === "GET") {
    try {
      const { brokerId } = req.query;

      if (!brokerId || typeof brokerId !== "string") {
        return res.status(400).json({ message: "Broker ID is required" });
      }

      const reviews = await prisma.review.findMany({
        where: { brokerId },
        include: {
          borrower: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json(reviews);
    } catch (error) {
      console.error("Get reviews error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
