import type { ReactNode } from "react";

export type Tone =
  | "neutral"
  | "accent"
  | "success"
  | "danger"
  | "info"
  | "warn"
  | "dark";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-cream-200 text-forest-700 border-cream-300",
  accent: "bg-amber-50 text-amber-700 border-amber-200",
  success: "bg-success-50 text-success-700 border-success-100",
  danger: "bg-error-50 text-error-700 border-error-100",
  info: "bg-info-50 text-info-700 border-info-100",
  warn: "bg-warning-50 text-warning-700 border-warning-100",
  dark: "bg-forest-800 text-cream-100 border-forest-800",
};

export interface ABadgeProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}

export default function ABadge({ children, tone = "neutral", className = "" }: ABadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border font-mono text-[10px] font-semibold tracking-[0.1em] uppercase ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
