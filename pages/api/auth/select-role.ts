import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { encode } from "next-auth/jwt";
import { authOptions, invalidateSessionDbCache } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isAllowedOrigin } from "@/lib/origin";
import { normalizeEmail } from "@/lib/normalizeEmail";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const MOBILE_HEADER = "x-mortly-mobile";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // CSRF gate — same-origin or trusted mobile client only.
  const isMobile = req.headers[MOBILE_HEADER] === "1";
  if (!isMobile && !isAllowedOrigin(req)) {
    return res.status(403).json({ message: "Cross-origin request rejected" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { role } = req.body;
  if (role !== "BORROWER" && role !== "BROKER") {
    return res.status(400).json({ message: "Invalid role" });
  }

  const sessionId = session.user.id;
  const sessionEmail = (session.user as { email?: string | null }).email;

  let user = await prisma.user.findUnique({
    where: { id: sessionId },
    select: { id: true, publicId: true, email: true, name: true, role: true, preferences: true },
  });

  if (!user && sessionEmail) {
    user = await prisma.user.findUnique({
      where: { email: normalizeEmail(sessionEmail) },
      select: { id: true, publicId: true, email: true, name: true, role: true, preferences: true },
    });
  }

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Hard rule — this endpoint is for first-time role selection only.
  // Without these guards any logged-in user could flip their own role at will
  // (BORROWER → BROKER lets them later mint a Broker profile + accept clients
  // pre-verification), and a CSRF-induced ADMIN call could downgrade an admin
  // to BORROWER and lock them out of the admin surface.
  if (user.role === "ADMIN") {
    return res.status(403).json({ message: "Admins cannot change role via this endpoint" });
  }
  const prefs = (user.preferences as Record<string, unknown>) || {};
  if (prefs.needsRoleSelection !== true) {
    return res.status(409).json({ message: "Role has already been selected" });
  }

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

  // Drop the cached DB snapshot so the very next /api/auth/session call
  // (the page calls update() right after this returns) re-reads the new
  // role from Postgres. Without this the session callback serves the
  // pre-update role for up to 5 seconds — long enough that the redirect
  // to /broker/dashboard renders as a borrower.
  invalidateSessionDbCache(user.id);

  // Mobile clients store the raw session token themselves; web clients use
  // the HttpOnly cookie set by NextAuth. Returning a long-lived JWT in the
  // response body to a browser would let any XSS exfiltrate it, so we gate
  // the token behind an explicit mobile header.
  let sessionToken: string | null = null;
  if (isMobile) {
    const secret = process.env.NEXTAUTH_SECRET;
    if (secret) {
      const fresh = await prisma.user.findUnique({
        where: { id: user.id },
        select: { tokenVersion: true, status: true },
      });
      sessionToken = await encode({
        token: {
          id: user.id,
          publicId: user.publicId,
          email: user.email,
          name: user.name,
          role,
          needsRoleSelection: false,
          tokenVersion: fresh?.tokenVersion ?? 0,
          status: fresh?.status ?? "ACTIVE",
        },
        secret,
        maxAge: SESSION_MAX_AGE,
      });
    }
  }

  return res.status(200).json({
    success: true,
    role,
    ...(sessionToken ? { sessionToken } : {}),
  });
}
