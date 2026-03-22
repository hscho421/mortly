import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validateProductTypes } from "@/lib/requestConfig";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id: publicId } = req.query;
  if (!publicId || typeof publicId !== "string") {
    return res.status(400).json({ error: "Invalid request ID" });
  }

  try {
    // Look up by publicId or fall back to internal id for backwards compatibility
    const lookup = /^\d{9}$/.test(publicId)
      ? { publicId }
      : { id: publicId };

    if (req.method === "GET") {
      const request = await prisma.borrowerRequest.findUnique({
        where: lookup,
        include: {
          _count: {
            select: { introductions: true },
          },
          introductions: {
            include: {
              broker: { include: { user: true } },
            },
          },
          conversations: {
            select: { status: true },
          },
        },
      });

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (session.user.role === "BORROWER" && request.borrowerId !== session.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (session.user.role === "BROKER") {
        const broker = await prisma.broker.findUnique({
          where: { userId: session.user.id },
        });
        if (!broker || broker.verificationStatus !== "VERIFIED") {
          return res.status(403).json({ error: "Broker must be verified to view requests" });
        }
        if (request.status !== "OPEN") {
          const hasResponded = request.introductions.some(
            (intro: { broker: { userId: string } }) => intro.broker.userId === session.user.id
          );
          if (!hasResponded) {
            return res.status(403).json({ error: "Forbidden" });
          }
        }
      }

      return res.status(200).json(request);
    }

    if (req.method === "PUT") {
      const request = await prisma.borrowerRequest.findUnique({
        where: lookup,
      });

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (request.borrowerId !== session.user.id) {
        return res.status(403).json({ error: "Only the owning borrower can update this request" });
      }

      const { status } = req.body;

      const updated = await prisma.borrowerRequest.update({
        where: { id: request.id },
        data: { status },
      });

      if (status === "CLOSED") {
        const activeConversations = await prisma.conversation.findMany({
          where: { requestId: request.id, status: "ACTIVE" },
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

    if (req.method === "PATCH") {
      const request = await prisma.borrowerRequest.findUnique({
        where: lookup,
      });

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (request.borrowerId !== session.user.id) {
        return res.status(403).json({ error: "Only the owning borrower can edit this request" });
      }

      if (request.status !== "OPEN" && request.status !== "PENDING_APPROVAL") {
        return res.status(400).json({ error: "Can only edit requests with OPEN or PENDING_APPROVAL status" });
      }

      // v2 request editing
      if (request.schemaVersion === 2) {
        const {
          mortgageCategory,
          productTypes,
          province,
          city,
          details,
          desiredTimeline,
          notes,
        } = req.body;

        // Validate product types if provided
        if (productTypes) {
          const cat = mortgageCategory || request.mortgageCategory;
          if (!validateProductTypes(cat, productTypes)) {
            return res.status(400).json({ error: "Invalid product type for selected category" });
          }
        }

        const updated = await prisma.borrowerRequest.update({
          where: { id: request.id },
          data: {
            ...(mortgageCategory && { mortgageCategory }),
            ...(productTypes && { productTypes }),
            ...(province && { province }),
            ...(city !== undefined && { city: city || null }),
            ...(details && { details }),
            ...(desiredTimeline !== undefined && { desiredTimeline: desiredTimeline || null }),
            ...(notes !== undefined && { notes: notes || null }),
          },
        });

        return res.status(200).json(updated);
      }

      // v1 legacy request editing
      const {
        mortgageCategory,
        requestType,
        province,
        city,
        propertyType,
        priceRangeMin,
        priceRangeMax,
        downPaymentPercent,
        incomeRangeMin,
        incomeRangeMax,
        employmentType,
        creditScoreBand,
        debtRangeMin,
        debtRangeMax,
        mortgageAmountMin,
        mortgageAmountMax,
        preferredTerm,
        preferredType,
        closingTimeline,
        notes,
      } = req.body;

      const updated = await prisma.borrowerRequest.update({
        where: { id: request.id },
        data: {
          mortgageCategory,
          requestType,
          province,
          city,
          propertyType,
          priceRangeMin,
          priceRangeMax,
          downPaymentPercent,
          incomeRangeMin,
          incomeRangeMax,
          employmentType,
          creditScoreBand,
          debtRangeMin,
          debtRangeMax,
          mortgageAmountMin,
          mortgageAmountMax,
          preferredTerm,
          preferredType,
          closingTimeline,
          notes,
        },
      });

      return res.status(200).json(updated);
    }

    if (req.method === "DELETE") {
      const request = await prisma.borrowerRequest.findUnique({
        where: lookup,
      });

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (request.borrowerId !== session.user.id) {
        return res.status(403).json({ error: "Only the owning borrower can delete this request" });
      }

      if (request.status !== "OPEN" && request.status !== "PENDING_APPROVAL") {
        return res.status(400).json({ error: "Can only delete requests with OPEN or PENDING_APPROVAL status" });
      }

      // Delete related data in correct order (respecting foreign keys)
      const conversations = await prisma.conversation.findMany({
        where: { requestId: request.id },
        select: { id: true },
      });

      const conversationIds = conversations.map((c) => c.id);

      if (conversationIds.length > 0) {
        // Delete messages in conversations
        await prisma.message.deleteMany({
          where: { conversationId: { in: conversationIds } },
        });

        // Delete conversations
        await prisma.conversation.deleteMany({
          where: { requestId: request.id },
        });
      }

      // Delete introductions
      await prisma.brokerIntroduction.deleteMany({
        where: { requestId: request.id },
      });

      // Delete the request itself
      await prisma.borrowerRequest.delete({
        where: { id: request.id },
      });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/requests/[id]:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
