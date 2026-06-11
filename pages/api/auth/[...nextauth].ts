import type { NextApiRequest, NextApiResponse } from "next";
import NextAuth from "next-auth";
import { createAuthOptions } from "@/lib/auth";
import { LEGAL_ACCEPTANCE_COOKIE } from "@/lib/legal";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizeEmail } from "@/lib/normalizeEmail";

// Brute-force protection for credential sign-in. NextAuth applies NONE by
// default, so POST /api/auth/callback/credentials was an unthrottled password-
// spraying / credential-stuffing surface guarding borrower financial PII. We
// gate that one path with a durable per-IP AND per-email cap before delegating
// to NextAuth. OAuth callbacks and every other NextAuth route are untouched.
const LOGIN_PER_IP = 30;
const LOGIN_PER_EMAIL = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function isCredentialsCallback(req: NextApiRequest): boolean {
  const seg = req.query.nextauth;
  const parts = Array.isArray(seg) ? seg : [seg];
  return req.method === "POST" && parts[0] === "callback" && parts[1] === "credentials";
}

export default async function auth(req: NextApiRequest, res: NextApiResponse) {
  if (isCredentialsCallback(req)) {
    const ip = getClientIp(req);
    const rawEmail = typeof req.body?.email === "string" ? req.body.email : "";
    const email = rawEmail ? normalizeEmail(rawEmail) : "";

    const checks = [
      checkRateLimit({ key: `login-ip-${ip}`, limit: LOGIN_PER_IP, windowMs: LOGIN_WINDOW_MS }),
    ];
    // Per-account cap stops slow-spraying a single victim from many IPs.
    if (email) {
      checks.push(
        checkRateLimit({ key: `login-email-${email}`, limit: LOGIN_PER_EMAIL, windowMs: LOGIN_WINDOW_MS }),
      );
    }
    const results = await Promise.all(checks);
    if (results.some((r) => !r.success)) {
      res.setHeader("Retry-After", "900");
      // next-auth's client signIn() reads `data.url` (not the status) to extract
      // the error code, so include a NextAuth-shaped url alongside the 429 — the
      // web login page surfaces "RATE_LIMITED" while REST/mobile clients still
      // get the 429 + Retry-After.
      const base = process.env.NEXTAUTH_URL ?? "";
      return res.status(429).json({
        url: `${base}/login?error=RATE_LIMITED`,
        error: "Too many sign-in attempts. Please wait a few minutes and try again.",
      });
    }
  }

  const acceptedLegalVersion =
    typeof req.cookies[LEGAL_ACCEPTANCE_COOKIE] === "string"
      ? req.cookies[LEGAL_ACCEPTANCE_COOKIE]
      : null;

  return await NextAuth(req, res, createAuthOptions(acceptedLegalVersion));
}
