import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";

const ALLOWED_LOCALES = new Set(["en", "ko"]);
const ALLOWED_THEMES = new Set(["light", "dark", "system"]);

/**
 * Per-key validation. Anything outside the allowlist is rejected so a typed
 * value can't leak through and later show up in HTML attributes / lang tags.
 */
function validatePreference(key: string, value: unknown): unknown {
  switch (key) {
    case "locale":
      if (typeof value !== "string" || !ALLOWED_LOCALES.has(value)) {
        throw new Error("locale must be 'en' or 'ko'");
      }
      return value;
    case "theme":
      if (typeof value !== "string" || !ALLOWED_THEMES.has(value)) {
        throw new Error("theme must be 'light', 'dark', or 'system'");
      }
      return value;
    case "emailNotifications":
    case "pushNotifications":
      if (typeof value !== "boolean") {
        throw new Error(`${key} must be a boolean`);
      }
      return value;
    default:
      return undefined;
  }
}

export default withAuth(async (req, res, session) => {
  if (req.method === "GET") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });
    return res.json(user?.preferences ?? {});
  }

  if (req.method === "PUT") {
    const { preferences } = req.body;
    if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) {
      return res.status(400).json({ message: "Invalid preferences" });
    }

    const serialized = JSON.stringify(preferences);
    if (serialized.length > 10000) {
      return res.status(400).json({ message: "Preferences too large (max 10KB)" });
    }

    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(preferences as Record<string, unknown>)) {
      try {
        const v = validatePreference(key, value);
        if (v !== undefined) filtered[key] = v;
      } catch (err) {
        return res
          .status(400)
          .json({ message: err instanceof Error ? err.message : "Invalid preference value" });
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });
    const existing = (user?.preferences as Record<string, unknown>) ?? {};
    const merged = { ...existing, ...filtered };

    await prisma.user.update({
      where: { id: session.user.id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { preferences: merged as any },
    });

    return res.json(merged);
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ message: "Method not allowed" });
});
