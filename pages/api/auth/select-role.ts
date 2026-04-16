import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { encode } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { role } = req.body;
  if (role !== "BORROWER" && role !== "BROKER") {
    return res.status(400).json({ message: "Invalid role" });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, publicId: true, email: true, name: true, role: true, preferences: true },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Idempotent by design: this endpoint is safe to call whether or not
  // `needsRoleSelection` is still set. Users who were stuck in the old
  // bug loop (DB cleared but JWT stale) would otherwise get locked out
  // permanently. We always update role + clear the flag + issue a fresh
  // token — every path leads to a consistent success state.
  const prefs = (user.preferences as Record<string, unknown>) || {};
  const restPrefs = { ...prefs };
  delete restPrefs.needsRoleSelection;
  const newPrefs = Object.keys(restPrefs).length > 0 ? JSON.parse(JSON.stringify(restPrefs)) : null;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      role,
      preferences: newPrefs,
    },
  });

  // Re-encode the JWT so the client's next getSession() sees the updated
  // role and cleared needsRoleSelection. Without this, NextAuth's jwt
  // callback only refreshes from DB on fresh sign-in (`account`) or
  // `trigger: "update"` — a plain GET /api/auth/session returns stale
  // token data, which would loop the user back to /select-role.
  const secret = process.env.NEXTAUTH_SECRET;
  let sessionToken: string | null = null;
  if (secret) {
    sessionToken = await encode({
      token: {
        id: user.id,
        publicId: user.publicId,
        email: user.email,
        name: user.name,
        role,
        needsRoleSelection: false,
      },
      secret,
      maxAge: SESSION_MAX_AGE,
    });
  }

  return res.status(200).json({
    success: true,
    role,
    ...(sessionToken ? { sessionToken } : {}),
  });
}
