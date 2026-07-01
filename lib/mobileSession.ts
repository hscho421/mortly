import { encode } from "next-auth/jwt";
import type { User } from "@prisma/client";
import { MOBILE_SESSION_MAX_AGE_SECONDS } from "@mortly/core/constants";

/**
 * Mint the session token + response body for a mobile client. Kept identical
 * to the shape produced by /api/auth/mobile-oauth so credentials login, Apple,
 * and Google all hand the app the same contract. The JWT embeds `tokenVersion`
 * + `status` so the session read can detect server-side revocation.
 */

function onboardingFlags(user: Pick<User, "preferences" | "name">) {
  const prefs = (user.preferences as Record<string, unknown> | null) ?? {};
  return {
    needsRoleSelection: prefs.needsRoleSelection === true,
    needsNameEntry: prefs.needsNameEntry === true || !user.name,
  };
}

/** The safe user object returned to the client (no secrets). */
export function mobileSessionUser(user: User) {
  const { needsRoleSelection, needsNameEntry } = onboardingFlags(user);
  return {
    id: user.id,
    publicId: user.publicId,
    email: user.email,
    name: user.name,
    role: user.role,
    needsRoleSelection,
    needsNameEntry,
  };
}

/** Encode a 30-day mobile session JWT. Throws if NEXTAUTH_SECRET is unset. */
export async function mintMobileSessionToken(user: User): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET not configured");
  const { needsRoleSelection, needsNameEntry } = onboardingFlags(user);
  return encode({
    token: {
      id: user.id,
      publicId: user.publicId,
      email: user.email,
      name: user.name,
      role: user.role,
      needsRoleSelection,
      needsNameEntry,
      tokenVersion: user.tokenVersion,
      status: user.status,
    },
    secret,
    maxAge: MOBILE_SESSION_MAX_AGE_SECONDS,
  });
}
