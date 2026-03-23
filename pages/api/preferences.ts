import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ message: "Unauthorized" });

  if (req.method === "GET") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });
    return res.json(user?.preferences ?? {});
  }

  if (req.method === "PUT") {
    const { preferences } = req.body;
    if (!preferences || typeof preferences !== "object") {
      return res.status(400).json({ message: "Invalid preferences" });
    }

    // Merge with existing preferences so partial updates work
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const existing = (user?.preferences as Record<string, unknown>) ?? {};
    const merged = { ...existing, ...preferences };

    await prisma.user.update({
      where: { id: session.user.id },
      data: { preferences: merged },
    });

    return res.json(merged);
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ message: "Method not allowed" });
}
