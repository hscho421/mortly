import type { ReactNode } from "react";

export type BannerTone = "info" | "success" | "warning" | "danger" | "neutral";

const TONE_CLASS: Record<BannerTone, string> = {
  info: "bg-info-50 border-info-100 text-info-700",
  success: "bg-success-50 border-success-100 text-success-700",
  warning: "bg-warning-50 border-warning-100 text-warning-700",
  danger: "bg-error-50 border-error-100 text-error-700",
  neutral: "bg-cream-100 border-cream-300 text-forest-800",
};

const ICON_CLASS: Record<BannerTone, string> = {
  info: "text-info-700",
  success: "text-success-700",
  warning: "text-warning-700",
  danger: "text-error-700",
  neutral: "text-forest-800",
};

export interface BannerProps {
  tone?: BannerTone;
  title: ReactNode;
  description?: ReactNode;
  /** Optional leading glyph. Falls back to a tone-appropriate default. */
  icon?: ReactNode;
  /** Slot for an action button on the right. */
  action?: ReactNode;
  /** When provided, renders an X dismiss button that calls this handler. */
  onDismiss?: () => void;
  className?: string;
}

/**
 * Sharp banner primitive for the dashboard/form status surfaces.
 *
 * Replaces the bespoke `animate-fade-in-up rounded-2xl border-2` banners
 * scattered across broker/dashboard (verified / pending / free-plan),
 * borrower/dashboard (error), broker/billing (status blocks) etc.
 *
 * Visual language matches the admin design system: rounded-sm, semantic
 * tone backgrounds pulled from the same token set ABadge uses.
 */
export default function Banner({
  tone = "neutral",
  title,
  description,
  icon,
  action,
  onDismiss,
  className = "",
}: BannerProps) {
  const defaultIcon = DEFAULT_ICONS[tone];
  const body = (
    <div className="flex-1 min-w-0">
      <div className="font-body text-sm font-semibold">{title}</div>
      {description && (
        <div className="font-body text-[13px] text-forest-700/80 mt-0.5 leading-relaxed">
          {description}
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`flex items-start gap-3 border rounded-sm p-4 ${TONE_CLASS[tone]} ${className}`}
      role="status"
    >
      <span className={`shrink-0 mt-0.5 ${ICON_CLASS[tone]}`} aria-hidden>
        {icon ?? defaultIcon}
      </span>
      {body}
      {action && <div className="shrink-0 self-center">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={`shrink-0 -mr-1 -mt-1 p-1 transition-colors ${ICON_CLASS[tone]} hover:opacity-70`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// Default glyphs — Unicode per tone, consistent with admin's icon style.
const DEFAULT_ICONS: Record<BannerTone, ReactNode> = {
  info: <span className="font-mono text-[15px]">i</span>,
  success: <span className="font-mono text-[15px]">✓</span>,
  warning: <span className="font-mono text-[15px]">!</span>,
  danger: <span className="font-mono text-[15px]">!</span>,
  neutral: <span className="font-mono text-[15px]">·</span>,
};
