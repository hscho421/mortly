/**
 * SSR-safe date formatting helpers for admin UI.
 *
 * No `window`, `document`, or locale detection — these are pure and produce
 * identical output on server and client.
 */

type FormatStyle = "short" | "long" | "relative";

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * `YYYY-MM-DD HH:mm` in the host system's local time. We intentionally use
 * `Date#get*` (local) rather than UTC methods to match what developers see
 * in their terminal and what existing admin tables display via ad-hoc
 * formatters.
 */
function formatShort(d: Date): string {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

/**
 * Locale-aware "medium date + short time", e.g. `Apr 16, 2026, 3:04 PM`.
 * Uses `en-US` explicitly so output is deterministic across environments.
 */
function formatLong(d: Date): string {
  return d.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Human-readable relative time: `"just now"`, `"2m ago"`, `"3h ago"`,
 * `"5d ago"`. For anything older than 30 days, falls back to the `short`
 * format so the output stays unambiguous.
 */
function formatRelative(d: Date): string {
  const now = Date.now();
  const diffMs = now - d.getTime();

  // Future dates — fall through to short so we don't lie with "in 2m".
  if (diffMs < 0) return formatShort(d);

  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return "just now";

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const days = Math.floor(hr / 24);
  if (days <= 30) return `${days}d ago`;

  return formatShort(d);
}

/**
 * Format a date for admin views.
 *
 *   - `null` / `undefined`     → `"—"` (em dash)
 *   - Invalid date             → `"—"`
 *   - `style: "short"` (default) → `YYYY-MM-DD HH:mm`
 *   - `style: "long"`          → `toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })`
 *   - `style: "relative"`      → `"2m ago"` / `"3h ago"` / `"5d ago"`,
 *                                falls back to short for > 30 days or future dates
 *
 * Pure and SSR-safe — no `window`, `document`, or `Intl.RelativeTimeFormat`
 * locale detection. Input may be a `Date` or any string `Date` accepts.
 */
export function formatAdminDate(
  date: Date | string | null | undefined,
  style: FormatStyle = "short"
): string {
  if (date === null || date === undefined) return "—";

  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";

  switch (style) {
    case "long":
      return formatLong(d);
    case "relative":
      return formatRelative(d);
    case "short":
    default:
      return formatShort(d);
  }
}

export default formatAdminDate;
