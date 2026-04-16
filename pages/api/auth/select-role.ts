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

  // Try to resolve user by session.user.id first, then fall back to email.
  // Some mobile JWT paths have had session.user.id drift from the real DB id
  // (e.g. stale encoded tokens predating schema migrations). Falling back to
  // email unsticks users whose session id doesn't resolve but who are clearly
  // authenticated (session was valid enough to reach this handler).
  const sessionId = session.user.id;
  const sessionEmail = (session.user as { email?: string | null }).email;

  let user = await prisma.user.findUnique({
    where: { id: sessionId },
    select: { id: true, publicId: true, email: true, name: true, role: true, preferences: true },
  });

  if (!user && sessionEmail) {
    user = await prisma.user.findUnique({
      where: { email: sessionEmail.toLowerCase() },
      select: { id: true, publicId: true, email: true, name: true, role: true, preferences: true },
    });
    if (user) {
      console.warn(
        `[select-role] session.user.id (${sessionId}) did not match DB, recovered via email (${sessionEmail}) → user.id=${user.id}`,
      );
    }
  }

  if (!user) {
    console.error(
      `[select-role] User not found — sessionId=${sessionId}, sessionEmail=${sessionEmail ?? "(none)"}`,
    );
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
