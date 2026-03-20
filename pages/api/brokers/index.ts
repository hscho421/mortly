import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { province, specialty } = req.query;

    const where: Record<string, unknown> = {
      verificationStatus: "VERIFIED",
    };

    if (province && typeof province === "string") {
      where.province = province;
    }

    if (specialty && typeof specialty === "string") {
      where.specialties = { contains: specialty, mode: "insensitive" };
    }

    const brokers = await prisma.broker.findMany({
      where,
      select: {
        id: true,
        brokerageName: true,
        province: true,
        bio: true,
        yearsExperience: true,
        areasServed: true,
        specialties: true,
        rating: true,
        completedMatches: true,
        user: {
          select: { name: true },
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            borrower: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
      orderBy: [
        { rating: { sort: "desc", nulls: "last" } },
        { completedMatches: "desc" },
      ],
    });

    return res.status(200).json(brokers);
  } catch (error) {
    console.error("List brokers error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
