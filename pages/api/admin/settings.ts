import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }

  if (req.method === "GET") {
    try {
      const settings = await prisma.systemSetting.findMany();
      const map: Record<string, string> = {};
      for (const s of settings) {
        map[s.key] = s.value;
      }
      return res.status(200).json(map);
    } catch (error) {
      console.error("Error fetching settings:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method === "PUT") {
    try {
      const updates = req.body as Record<string, string>;

      if (!updates || typeof updates !== "object") {
        return res.status(400).json({ error: "Request body must be a key-value object" });
      }

      await prisma.$transaction([
        ...Object.entries(updates).map(([key, value]) =>
          prisma.systemSetting.upsert({
            where: { key },
            update: { value: String(value) },
            create: { key, value: String(value) },
          })
        ),
      ]);

      await prisma.adminAction.create({
        data: {
          adminId: session.user.id,
          action: "UPDATE_SETTINGS",
          targetType: "SYSTEM",
          targetId: "settings",
          details: JSON.stringify(updates),
        },
      });

      const settings = await prisma.systemSetting.findMany();
      const map: Record<string, string> = {};
      for (const s of settings) {
        map[s.key] = s.value;
      }
      return res.status(200).json(map);
    } catch (error) {
      console.error("Error updating settings:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
