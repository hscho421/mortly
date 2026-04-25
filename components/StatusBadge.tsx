import React from "react";
import { useTranslation } from "next-i18next";
import { UBadge, type Tone } from "@/components/ui";

interface StatusBadgeProps {
  status: string;
  variant?: string;
}

/**
 * Public-side status badge — maps a raw status string to a semantic tone
 * and renders through the shared UBadge primitive. Previously used the
 * rose/sky/emerald/violet legacy palette via a hand-rolled classList; this
 * version routes everything through the design system's tone tokens so
 * palette changes are one edit in `tones.ts`.
 */

const STATUS_TONE: Record<string, Tone> = {
  OPEN: "success",
  ACTIVE: "success",
  VERIFIED: "success",
  RESOLVED: "success",

  IN_PROGRESS: "info",
  REVIEWED: "info",

  PENDING: "warn",
  PENDING_APPROVAL: "warn",
  NOT_SURE: "warn",

  CLOSED: "neutral",
  EXPIRED: "neutral",
  CANCELLED: "neutral",
  DISMISSED: "neutral",

  REJECTED: "danger",
};

const VARIANT_TONE: Record<string, Tone> = {
  success: "success",
  warning: "warn",
  error: "danger",
  info: "info",
  neutral: "neutral",
  accent: "accent",
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  OPEN: "statusLabel.OPEN",
  ACTIVE: "statusLabel.ACTIVE",
  VERIFIED: "statusLabel.VERIFIED",
  RESOLVED: "statusLabel.RESOLVED",
  IN_PROGRESS: "statusLabel.IN_PROGRESS",
  PENDING: "statusLabel.PENDING",
  PENDING_APPROVAL: "statusLabel.PENDING_APPROVAL",
  NOT_SURE: "statusLabel.NOT_SURE",
  CLOSED: "statusLabel.CLOSED",
  EXPIRED: "statusLabel.EXPIRED",
  CANCELLED: "statusLabel.CANCELLED",
  DISMISSED: "statusLabel.DISMISSED",
  REJECTED: "statusLabel.REJECTED",
  REVIEWED: "statusLabel.REVIEWED",
};

export default function StatusBadge({ status, variant }: StatusBadgeProps) {
  const { t } = useTranslation("common");
  const tone: Tone =
    (variant && VARIANT_TONE[variant]) || STATUS_TONE[status] || "neutral";
  const label = STATUS_LABEL_KEYS[status]
    ? t(STATUS_LABEL_KEYS[status])
    : status.replace(/_/g, " ");

  return <UBadge tone={tone}>{label}</UBadge>;
}
