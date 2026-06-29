import { useEffect } from "react";

/**
 * Cookieless visitor-geography beacon. Fires once per browser session to
 * /api/analytics/geo, which reads Vercel's edge IP-geo headers and stores an
 * approximate city/province (no IP, no cookie, no PII). The once-per-session
 * guard uses sessionStorage (cleared when the tab closes — NOT a tracking
 * cookie). Fire-and-forget; never blocks rendering and ignores all failures.
 */
const SESSION_FLAG = "mortly:geo-pinged";

export default function GeoBeacon() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_FLAG)) return;
      sessionStorage.setItem(SESSION_FLAG, "1");
    } catch {
      // Storage blocked (private mode) — skip rather than risk double-counting.
      return;
    }

    const payload = JSON.stringify({
      path: window.location.pathname,
      referrer: document.referrer || "",
    });

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/analytics/geo",
          new Blob([payload], { type: "application/json" }),
        );
      } else {
        void fetch("/api/analytics/geo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // ignore — analytics is best-effort
    }
  }, []);

  return null;
}
