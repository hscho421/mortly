import type { Tone } from "./ABadge";

/**
 * Shared tone mappings for admin status-like values. Centralizes the
 * legacy-era `STATUS_BADGE` / `ROLE_BADGE` / `TIER_BADGE` / `VERIFICATION_BADGE`
 * class maps that were duplicated across `users/[id]`, `brokers/[id]`, and
 * `conversations/[id]`. All admin pages should route through these helpers
 * so a palette change is a one-line edit.
 */

export function toneForUserStatus(status: string): Tone {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "SUSPENDED":
      return "warn";
    case "BANNED":
      return "danger";
    default:
      return "neutral";
  }
}

export function toneForRole(role: string): Tone {
  switch (role) {
    case "ADMIN":
      return "dark";
    case "BROKER":
      return "accent";
    case "BORROWER":
      return "neutral";
    default:
      return "neutral";
  }
}

export function toneForVerification(status: string): Tone {
  switch (status) {
    case "VERIFIED":
      return "success";
    case "PENDING":
      return "warn";
    case "REJECTED":
      return "danger";
    default:
      return "neutral";
  }
}

export function toneForTier(tier: string): Tone {
  switch (tier) {
    case "PREMIUM":
      return "accent";
    case "PRO":
      return "info";
    case "BASIC":
      return "neutral";
    case "FREE":
      return "neutral";
    default:
      return "neutral";
  }
}

export function toneForRequestStatus(status: string): Tone {
  switch (status) {
    case "OPEN":
      return "accent";
    case "IN_PROGRESS":
      return "warn";
    case "PENDING_APPROVAL":
      return "warn";
    case "REJECTED":
      return "danger";
    case "EXPIRED":
      return "neutral";
    case "CLOSED":
      return "neutral";
    default:
      return "neutral";
  }
}

export function toneForConversationStatus(status: string): Tone {
  return status === "ACTIVE" ? "info" : "neutral";
}

export function toneForReportStatus(status: string): Tone {
  switch (status) {
    case "OPEN":
      return "danger";
    case "REVIEWED":
      return "warn";
    case "RESOLVED":
      return "success";
    case "DISMISSED":
      return "neutral";
    default:
      return "neutral";
  }
}
