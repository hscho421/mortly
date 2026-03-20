import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const days = 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [users, requests, conversations] = await Promise.all([
      prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.borrowerRequest.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.conversation.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Build daily buckets
    const buckets: Record<string, { users: number; requests: number; conversations: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { users: 0, requests: 0, conversations: 0 };
    }

    for (const u of users) {
      const key = u.createdAt.toISOString().slice(0, 10);
      if (buckets[key]) buckets[key].users++;
    }
    for (const r of requests) {
      const key = r.createdAt.toISOString().slice(0, 10);
      if (buckets[key]) buckets[key].requests++;
    }
    for (const c of conversations) {
      const key = c.createdAt.toISOString().slice(0, 10);
      if (buckets[key]) buckets[key].conversations++;
    }

    const trend = Object.entries(buckets).map(([date, counts]) => ({
      date,
      ...counts,
    }));

    return res.status(200).json(trend);
  } catch (error) {
    console.error("Error in /api/admin/trends:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
