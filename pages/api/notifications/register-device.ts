import prisma from "@/lib/prisma";
import { Expo } from "expo-server-sdk";
import { withAuth } from "@/lib/withAuth";

const PLATFORMS = ["IOS", "ANDROID", "WEB"] as const;
type Platform = (typeof PLATFORMS)[number];

export default withAuth(async (req, res, session) => {
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

      // Token-hijack guard: if this Expo token is already registered to a
      // different user we refuse the registration. Silently reassigning would
      // let an attacker who learns another user's push token (network sniffing
      // on a shared LAN, leaked log) steal their notifications by claiming the
      // token from their own account. The legitimate user must explicitly
      // unregister the old device first (DELETE), then re-register from the
      // new account.
      const existing = await prisma.deviceToken.findUnique({ where: { token } });
      if (existing && existing.userId !== session.user.id) {
        return res.status(409).json({
          error:
            "This device is already registered to a different account. Sign out of the other account on this device first.",
        });
      }

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
});

