import React from "react";
import { useTranslation } from "next-i18next";

interface StatusBadgeProps {
  status: string;
  variant?: string;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  VERIFIED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  RESOLVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  IN_PROGRESS: "bg-sky-50 text-sky-700 ring-sky-600/20",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 ring-amber-600/20",
  NOT_SURE: "bg-amber-50 text-amber-700 ring-amber-600/20",
  CLOSED: "bg-cream-300/50 text-forest-600 ring-cream-400/30",
  EXPIRED: "bg-cream-300/50 text-forest-600 ring-cream-400/30",
  CANCELLED: "bg-cream-300/50 text-forest-600 ring-cream-400/30",
  DISMISSED: "bg-cream-300/50 text-forest-600 ring-cream-400/30",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  REVIEWED: "bg-violet-50 text-violet-700 ring-violet-600/20",
};

const VARIANT_COLORS: Record<string, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  error: "bg-rose-50 text-rose-700 ring-rose-600/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
  neutral: "bg-cream-300/50 text-forest-600 ring-cream-400/30",
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
  const colorClass =
    (variant && VARIANT_COLORS[variant]) ||
    STATUS_COLORS[status] ||
    "bg-cream-300/50 text-forest-600 ring-cream-400/30";

  const label = STATUS_LABEL_KEYS[status] ? t(STATUS_LABEL_KEYS[status]) : status.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${colorClass}`}
    >
      {label}
    </span>
  );
}
