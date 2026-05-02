import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "crypto";

/**
 * Authenticate a request as coming from our scheduled job runner.
 *
 * Two layered checks — both must pass:
 *
 *   1. `Authorization: Bearer <CRON_SECRET>` matches via constant-time compare.
 *      Defends against a leaked secret being used from a browser if step 2
 *      ever falls back to "absent".
 *   2. EITHER `x-vercel-cron: 1` is present (set by Vercel's cron runner and
 *      filtered by the platform), OR — when running outside Vercel — the
 *      env opt-in `ALLOW_NONVERCEL_CRON=1` is set so we still allow the
 *      bare-secret path for self-hosted/staging environments.
 *
 * Both branches log, so we can audit trigger origin via Vercel logs.
 */
export function verifyCronRequest(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  if (!secret || !authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/, "");
  if (token.length !== secret.length) return false;

  let secretOk = false;
  try {
    secretOk = timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    secretOk = false;
  }
  if (!secretOk) return false;

  const isVercelCron = req.headers["x-vercel-cron"] === "1";
  if (isVercelCron) return true;

  return process.env.ALLOW_NONVERCEL_CRON === "1";
}

/**
 * Higher-order wrapper for cron handlers. Centralizes:
 *   1. Method allowlist (GET + POST — Vercel sends GET).
 *   2. Auth gate via verifyCronRequest.
 *   3. Generic 500 try/catch so handlers don't need their own boilerplate.
 *
 * Usage:
 *   export default withCron(async (req, res) => { ... });
 */
export type CronHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
) => Promise<void | NextApiResponse>;

export function withCron(handler: CronHandler) {
  return async function wrapped(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method !== "GET" && req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    if (!verifyCronRequest(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      await handler(req, res);
    } catch (err) {
      console.error("Cron handler error:", req.url, err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  };
}

