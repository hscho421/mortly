import type { ReactNode } from "react";

export interface ASectionHeadProps {
  /** eyebrow label, rendered as "— {label}" in mono amber */
  label?: string;
  title: ReactNode;
  /** when true, use the larger display size (Inbox-scale) */
  big?: boolean;
  right?: ReactNode;
  subtitle?: ReactNode;
}

export default function ASectionHead({
  label,
  title,
  big,
  right,
  subtitle,
}: ASectionHeadProps) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div className="min-w-0">
        {label && (
          <div className="eyebrow">— {label}</div>
        )}
        <h1
          className={`${big ? "text-4xl" : "text-2xl"} font-display font-semibold text-forest-800 tracking-tight mt-1.5 leading-tight`}
        >
          {title}
        </h1>
        {subtitle && (
          <div className="font-body text-[13px] text-sage-500 mt-1.5">{subtitle}</div>
        )}
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
}
