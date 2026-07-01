import type { NextApiRequest, NextApiResponse } from "next";
import { verifyCredentials } from "@/lib/auth";
import { mintMobileSessionToken, mobileSessionUser } from "@/lib/mobileSession";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Mobile email/password login. Verifies credentials via the SAME timing-safe
 * path as the web NextAuth credentials provider (lib/auth.verifyCredentials),
 * then mints the same 30-day mobile session token the OAuth endpoint returns.
 * On failure it returns the sentinel code as `error` so the app can map it to
 * a localized message (shared common.json), exactly like the web login page.
 */

const SENTINELS = new Set([
  "MISSING_CREDENTIALS",
  "INVALID_CREDENTIALS",
  "GOOGLE_ACCOUNT",
  "EMAIL_NOT_VERIFIED",
  "ACCOUNT_SUSPENDED",
  "ACCOUNT_BANNED",
]);

function statusFor(code: string): number {
  if (code === "MISSING_CREDENTIALS") return 400;
  if (code === "ACCOUNT_SUSPENDED" || code === "ACCOUNT_BANNED") return 403;
  return 401; // INVALID_CREDENTIALS / GOOGLE_ACCOUNT / EMAIL_NOT_VERIFIED
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.NEXTAUTH_SECRET) {
    return res.status(500).json({ error: "Server auth not configured" });
  }

  // Per-IP throttle — every call runs a bcrypt compare + account lookup, so
  // without this the endpoint is a password-spray / cost-amplification surface.
  const { success } = await checkRateLimit({
    key: `mobile-login-${getClientIp(req)}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (!success) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };

  try {
    const user = await verifyCredentials(email, password);
    const sessionToken = await mintMobileSessionToken(user);
    return res.status(200).json({ sessionToken, user: mobileSessionUser(user) });
  } catch (err) {
    const code = err instanceof Error ? err.message : "INVALID_CREDENTIALS";
    if (SENTINELS.has(code)) {
      return res.status(statusFor(code)).json({ error: code });
    }
    // Redacted — never echo raw auth errors.
    console.error("mobile-login error:", err instanceof Error ? err.name : "unknown");
    return res.status(500).json({ error: "AUTH_FAILED" });
  }
}
