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

  try {
    if (req.method === "GET") {
      const { search, status, type, page: pageStr, limit: limitStr } = req.query;

      const page = Math.max(1, parseInt(pageStr as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(limitStr as string) || 20));
      const skip = (page - 1) * limit;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};

      if (status && status !== "ALL") {
        where.status = status;
      }

      if (type && type !== "ALL") {
        where.mortgageCategory = type;
      }

      if (search && typeof search === "string" && search.trim()) {
        const s = search.trim();
        where.OR = [
          { publicId: { contains: s } },
          { province: { contains: s, mode: "insensitive" } },
          { city: { contains: s, mode: "insensitive" } },
          { borrower: { name: { contains: s, mode: "insensitive" } } },
        ];
      }

      const [requests, total] = await Promise.all([
        prisma.borrowerRequest.findMany({
          where,
          include: {
            borrower: {
              select: { id: true, name: true, email: true, status: true },
            },
            _count: {
              select: { conversations: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.borrowerRequest.count({ where }),
      ]);

      return res.status(200).json({
        data: requests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/admin/requests:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
