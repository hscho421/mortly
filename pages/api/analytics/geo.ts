import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Cookieless visitor-geography beacon. The client fires this once per session
 * (GeoBeacon). We read Vercel's edge IP-geo headers server-side and store an
 * approximate city/province — NO IP, NO cookie, NO PII — for aggregate admin
 * analytics. Rows are purged after 90 days (runPurgeExpired).
 *
 * Skips bots and signed-in admins (don't pollute the data with staff traffic),
 * and silently no-ops off-Vercel (local/dev) where the geo headers are absent.
 */

function deviceFromUA(ua: string): "mobile" | "tablet" | "desktop" {
  if (/\bipad\b|tablet|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini/i.test(ua))
    return "mobile";
  return "desktop";
}

function isBot(ua: string): boolean {
  return /bot|crawl|spider|slurp|bing|baidu|yandex|duckduck|facebookexternalhit|embedly|preview|fetch|monitor|headless|phantom|puppeteer|playwright|lighthouse|gtmetrix|pingdom|uptime|curl|wget|python-requests|axios|node-fetch/i.test(
    ua,
  );
}

function referrerHost(ref: string | undefined): string {
  if (!ref) return "direct";
  try {
    const host = new URL(ref).host;
    return host || "direct";
  } catch {
    return "direct";
  }
}

function header(req: NextApiRequest, key: string): string | null {
  const v = req.headers[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Beacon is fire-and-forget; always 204 so a client never blocks on it.
  if (req.method !== "POST") return res.status(405).end();

  const ua = (req.headers["user-agent"] as string) || "";
  if (isBot(ua)) return res.status(204).end();

  const country = header(req, "x-vercel-ip-country");
  // No geo headers → off-Vercel (local/dev) or a stripped proxy. Nothing to log.
  if (!country) return res.status(204).end();

  // Exclude signed-in admins so staff traffic doesn't skew the map. JWT session,
  // so this is a cheap cookie decode (no DB hit). Best-effort.
  let role = "anon";
  try {
    const session = (await getServerSession(req, res, authOptions)) as
      | { user?: { role?: string } }
      | null;
    if (session?.user?.role) role = String(session.user.role).toLowerCase();
  } catch {
    // ignore — treat as anonymous
  }
  if (role === "admin") return res.status(204).end();

  const region = header(req, "x-vercel-ip-country-region");
  const cityRaw = header(req, "x-vercel-ip-city");
  const city = cityRaw ? decodeURIComponent(cityRaw) : null;
  const latRaw = header(req, "x-vercel-ip-latitude");
  const lngRaw = header(req, "x-vercel-ip-longitude");
  const lat = latRaw ? Number.parseFloat(latRaw) : null;
  const lng = lngRaw ? Number.parseFloat(lngRaw) : null;
  const timezone = header(req, "x-vercel-ip-timezone");
  const device = deviceFromUA(ua);

  const body = (req.body ?? {}) as { path?: unknown; referrer?: unknown };
  const referrer = referrerHost(
    typeof body.referrer === "string" ? body.referrer : (req.headers["referer"] as string),
  );
  const path = typeof body.path === "string" ? body.path.slice(0, 256) : null;

  try {
    await prisma.geoVisit.create({
      data: {
        country,
        region,
        city,
        lat: lat !== null && Number.isFinite(lat) ? lat : null,
        lng: lng !== null && Number.isFinite(lng) ? lng : null,
        timezone,
        device,
        referrer: referrer.slice(0, 128),
        path,
        role,
      },
    });
  } catch (err) {
    // Analytics must never break a page load — log and move on.
    console.error("geo beacon insert failed:", err);
  }

  return res.status(204).end();
}
