import type { TFunction } from "i18next";

type Tone = "neutral" | "gold" | "success" | "error" | "info";

// Mirrors the web StatusBadge tone map (PENDING_APPROVAL "warn" → gold here).
const STATUS_TONE: Record<string, Tone> = {
  OPEN: "success",
  IN_PROGRESS: "info",
  PENDING_APPROVAL: "gold",
  CLOSED: "neutral",
  EXPIRED: "neutral",
  REJECTED: "error",
};

/** Localized label (statusLabel.* — present in common.json) + design-system tone. */
export function statusMeta(status: string, t: TFunction): { label: string; tone: Tone } {
  return { label: t(`statusLabel.${status}`, status), tone: STATUS_TONE[status] ?? "neutral" };
}

/** OPEN/IN_PROGRESS are "active"; everything else is historical. */
export function isActiveStatus(status: string): boolean {
  return status === "OPEN" || status === "IN_PROGRESS";
}
