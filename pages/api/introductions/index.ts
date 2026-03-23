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

  try {
    if (req.method === "GET") {
      const { requestId } = req.query;

      if (!requestId || typeof requestId !== "string") {
        return res.status(400).json({ error: "requestId query parameter is required" });
      }

      // Broker requesting all their introductions
      if (requestId === "all" && session.user.role === "BROKER") {
        const broker = await prisma.broker.findUnique({
          where: { userId: session.user.id },
        });
        if (!broker) {
          return res.status(404).json({ error: "Broker profile not found" });
        }

        const introductions = await prisma.brokerIntroduction.findMany({
          where: { brokerId: broker.id },
          include: {
            broker: {
              include: {
                user: {
                  select: { id: true, publicId: true, name: true, email: true },
                },
              },
            },
            request: {
              select: {
                id: true,
                requestType: true,
                province: true,
                city: true,
                mortgageCategory: true,
                productTypes: true,
                schemaVersion: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        return res.status(200).json(introductions);
      }

      // Resolve publicId to internal id
      const requestLookup = /^\d{9}$/.test(requestId)
        ? { publicId: requestId }
        : { id: requestId };
      const resolvedRequest = await prisma.borrowerRequest.findUnique({
        where: requestLookup,
        select: { id: true, borrowerId: true },
      });
      if (!resolvedRequest) {
        return res.status(404).json({ error: "Request not found" });
      }
      const internalRequestId = resolvedRequest.id;

      const where: Record<string, unknown> = { requestId: internalRequestId };

      if (session.user.role === "BORROWER") {
        const request = resolvedRequest;
        if (!request || request.borrowerId !== session.user.id) {
          return res.status(403).json({ error: "Forbidden" });
        }
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

      const introductions = await prisma.brokerIntroduction.findMany({
        where,
        include: {
          broker: {
            include: {
              user: {
                select: { id: true, publicId: true, name: true, email: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json(introductions);
    }

    if (req.method === "POST") {
      if (session.user.role !== "BROKER") {
        return res.status(403).json({ error: "Only brokers can create introductions" });
      }

      const broker = await prisma.broker.findUnique({
        where: { userId: session.user.id },
      });

      if (!broker) {
        return res.status(404).json({ error: "Broker profile not found" });
      }

      if (broker.verificationStatus !== "VERIFIED") {
        return res.status(403).json({ error: "Broker must be verified to send introductions" });
      }

      if (broker.subscriptionTier === "FREE") {
        return res.status(403).json({ error: "Free plan brokers cannot send introductions. Please upgrade your plan." });
      }

      const isPremium = broker.subscriptionTier === "PREMIUM";

      if (!isPremium && broker.responseCredits <= 0) {
        return res.status(403).json({ error: "No response credits remaining" });
      }

      const { requestId, message } = req.body;

      if (!requestId || !message) {
        return res.status(400).json({
          error: "requestId and message are required",
        });
      }

      // Resolve publicId to internal id for POST
      const postLookup = /^\d{9}$/.test(requestId)
        ? { publicId: requestId }
        : { id: requestId };
      const postRequest = await prisma.borrowerRequest.findUnique({
        where: postLookup,
        select: { id: true },
      });
      if (!postRequest) {
        return res.status(404).json({ error: "Request not found" });
      }
      const internalReqId = postRequest.id;

      const existing = await prisma.brokerIntroduction.findUnique({
        where: {
          requestId_brokerId: {
            requestId: internalReqId,
            brokerId: broker.id,
          },
        },
      });

      if (existing) {
        return res.status(409).json({ error: "You have already responded to this request" });
      }

      let introduction;

      if (isPremium) {
        // PREMIUM brokers have unlimited credits — no deduction needed
        introduction = await prisma.brokerIntroduction.create({
          data: {
            requestId: internalReqId,
            brokerId: broker.id,
            message,
          },
        });
      } else {
        introduction = await prisma.$transaction(async (tx) => {
          // Atomically check and decrement credits to prevent race conditions
          const updated = await tx.broker.updateMany({
            where: { id: broker.id, responseCredits: { gt: 0 } },
            data: { responseCredits: { decrement: 1 } },
          });

          if (updated.count === 0) {
            throw new Error("NO_CREDITS");
          }

          return tx.brokerIntroduction.create({
            data: {
              requestId: internalReqId,
              brokerId: broker.id,
              message,
            },
          });
        });
      }

      return res.status(201).json(introduction);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_CREDITS") {
      return res.status(403).json({ error: "No response credits remaining" });
    }
    console.error("Error in /api/introductions:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
