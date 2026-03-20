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
      const { province, requestType, propertyType } = req.query;

      const where: Record<string, unknown> = {};

      if (session.user.role === "BORROWER") {
        where.borrowerId = session.user.id;
      } else if (session.user.role === "BROKER") {
        where.status = "OPEN";
      } else {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (province && typeof province === "string") {
        where.province = province;
      }
      if (requestType && typeof requestType === "string") {
        where.requestType = requestType;
      }
      if (propertyType && typeof propertyType === "string") {
        where.propertyType = propertyType;
      }

      const requests = await prisma.borrowerRequest.findMany({
        where,
        include: {
          _count: {
            select: { introductions: true },
          },
          introductions: {
            select: {
              brokerId: true,
              broker: { select: { userId: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json(requests);
    }

    if (req.method === "POST") {
      if (session.user.role !== "BORROWER") {
        return res.status(403).json({ error: "Only borrowers can create requests" });
      }

      const { mortgageCategory, requestType, province, propertyType, ...rest } = req.body;

      if (!requestType || !province || !propertyType) {
        return res.status(400).json({
          error: "requestType, province, and propertyType are required",
        });
      }

      const request = await prisma.borrowerRequest.create({
        data: {
          borrowerId: session.user.id,
          mortgageCategory: mortgageCategory || "RESIDENTIAL",
          requestType,
          province,
          propertyType,
          ...rest,
        },
      });

      return res.status(201).json(request);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/requests:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
