import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Expo } from "expo-server-sdk";

const PLATFORMS = ["IOS", "ANDROID", "WEB"] as const;
type Platform = (typeof PLATFORMS)[number];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (req.method === "POST") {
      const { token, platform, locale, deviceName, appVersion } = req.body ?? {};

      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "token is required" });
      }
      if (!Expo.isExpoPushToken(token)) {
        return res.status(400).json({ error: "Invalid Expo push token" });
      }
      if (!platform || !PLATFORMS.includes(platform as Platform)) {
        return res.status(400).json({ error: "platform must be IOS, ANDROID, or WEB" });
      }

      const normalizedLocale = locale === "en" ? "en" : "ko";
      const now = new Date();

      // Upsert by token: if this token already exists (e.g., device handed off
      // between accounts on the same phone), reassign to the current user.
      await prisma.deviceToken.upsert({
        where: { token },
        create: {
          userId: session.user.id,
          token,
          platform: platform as Platform,
          locale: normalizedLocale,
          deviceName: typeof deviceName === "string" ? deviceName.slice(0, 100) : null,
          appVersion: typeof appVersion === "string" ? appVersion.slice(0, 30) : null,
          lastActiveAt: now,
        },
        update: {
          userId: session.user.id,
          platform: platform as Platform,
          locale: normalizedLocale,
          deviceName: typeof deviceName === "string" ? deviceName.slice(0, 100) : undefined,
          appVersion: typeof appVersion === "string" ? appVersion.slice(0, 30) : undefined,
          lastActiveAt: now,
          pushEnabled: true,
        },
      });

      return res.status(204).end();
    }

    if (req.method === "DELETE") {
      const { token } = req.body ?? {};
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "token is required" });
      }

      // Only delete if the token belongs to this user
      await prisma.deviceToken.deleteMany({
        where: { token, userId: session.user.id },
      });

      return res.status(204).end();
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Error in /api/notifications/register-device:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
