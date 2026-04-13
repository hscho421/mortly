import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { invalidateSettingsCache } from "@/lib/settings";

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

      const ALLOWED_KEYS = new Set([
        "request_expiry_days",
        "max_requests_per_user",
        "maintenance_mode",
        "free_tier_credits",
        "basic_tier_credits",
        "pro_tier_credits",
        "broker_initial_message_limit",
      ]);

      const entries = Object.entries(updates);
      if (entries.length === 0 || entries.length > 20) {
        return res.status(400).json({ error: "Must update between 1 and 20 settings" });
      }

      for (const [key, value] of entries) {
        if (!ALLOWED_KEYS.has(key)) {
          return res.status(400).json({ error: `Unknown setting: ${key}` });
        }
        if (typeof value !== "string" || value.length > 500) {
          return res.status(400).json({ error: `Invalid value for ${key}` });
        }
      }

      await prisma.$transaction([
        ...entries.map(([key, value]) =>
          prisma.systemSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
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

      invalidateSettingsCache();

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
