import { useEffect, useState, type ReactNode } from "react";
import ABtn from "./ABtn";

export interface AConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" → red confirm button. Use for destructive actions. */
  tone?: "default" | "danger";
  /**
   * When set, renders a textarea for free-text reason capture.
   *   - `requireReason: "required"` — confirm disabled until non-empty.
   *   - `requireReason: "optional"` — textarea shown but confirm always enabled.
   *
   * `onConfirm` receives the (trimmed) reason string, or `null` when omitted.
   */
  requireReason?: "required" | "optional";
  reasonLabel?: string;
  reasonPlaceholder?: string;
  /** Max reason length. Defaults to 500 to match the server-side cap. */
  reasonMaxLength?: number;

  onConfirm: (reason: string | null) => void | Promise<void>;
  /** Blocks close + disables buttons while a mutation is in flight. */
  loading?: boolean;
}

/**
 * Sharp admin confirmation dialog.
 *
 * Replaces `window.confirm / window.alert / window.prompt` in admin flows.
 * Matches the admin design system: square corners (rounded-sm), forest-800
 * border, cream surface, amber/error accent via ABtn.
 *
 * Phase 6: optional `requireReason` turns this dialog into a prompt too —
 * Activity's "close conversation" and "reject request" flows used to call
 * `window.prompt` for the reason; now they route through this dialog.
 */
export default function AConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel = "취소",
  tone = "default",
  requireReason,
  reasonLabel,
  reasonPlaceholder,
  reasonMaxLength = 500,
  onConfirm,
  loading = false,
}: AConfirmDialogProps) {
  const [reason, setReason] = useState("");

  // Reset the reason field every time the dialog transitions to open.
  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = typeof document !== "undefined" ? document.body.style.overflow : "";
    if (typeof document !== "undefined") {
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      if (typeof document !== "undefined") {
        document.body.style.overflow = prevOverflow;
      }
    };
  }, [open, loading, onClose]);

  if (!open) return null;

  const trimmedReason = reason.trim();
  const reasonBlocksConfirm = requireReason === "required" && trimmedReason.length === 0;
  const confirmDisabled = loading || reasonBlocksConfirm;

  const handleConfirm = () => {
    if (confirmDisabled) return;
    const payload = requireReason ? (trimmedReason.length > 0 ? trimmedReason : null) : null;
    void onConfirm(payload);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="aconfirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-800/55 backdrop-blur-[2px]"
      onClick={() => {
        if (!loading) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md bg-cream-50 border border-forest-800 rounded-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-cream-300">
          <h3
            id="aconfirm-title"
            className="font-display text-lg font-semibold text-forest-800 leading-tight"
          >
            {title}
          </h3>
        </div>
        {description && (
          <div className="px-6 py-4 text-[13px] text-forest-700/80 leading-relaxed">
            {description}
          </div>
        )}
        {requireReason && (
          <div className="px-6 pb-4">
            {reasonLabel && (
              <label
                htmlFor="aconfirm-reason"
                className="block font-mono text-[10px] text-sage-500 uppercase tracking-[0.15em] mb-1.5"
              >
                {reasonLabel}
                {requireReason === "optional" && (
                  <span className="normal-case tracking-normal text-sage-400 ml-2 lowercase">
                    ({cancelLabel === "취소" ? "선택" : "optional"})
                  </span>
                )}
              </label>
            )}
            <textarea
              id="aconfirm-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, reasonMaxLength))}
              placeholder={reasonPlaceholder}
              disabled={loading}
              rows={3}
              maxLength={reasonMaxLength}
              className="w-full border border-cream-300 bg-cream-50 px-3 py-2 text-[13px] text-forest-800 rounded-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/20 disabled:opacity-50"
            />
            <div className="font-mono text-[10px] text-sage-500 text-right mt-1">
              {reason.length}/{reasonMaxLength}
            </div>
          </div>
        )}
        <div className="px-6 py-4 border-t border-cream-300 flex gap-2 justify-end bg-cream-100">
          <ABtn variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </ABtn>
          <ABtn
            variant={tone === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={handleConfirm}
            disabled={confirmDisabled}
          >
            {loading ? "…" : confirmLabel}
          </ABtn>
        </div>
      </div>
    </div>
  );
}
