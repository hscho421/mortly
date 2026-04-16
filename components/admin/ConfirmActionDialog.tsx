import { useEffect, useState } from "react";

export interface ConfirmActionDialogProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Request close (Escape key, backdrop click, or Cancel button). */
  onClose: () => void;

  /** Dialog title, rendered with `font-heading`. */
  title: string;
  /** Optional body copy, rendered with `font-body`. */
  description?: string;

  /** Text on the confirm button. Defaults to `"Confirm"`. */
  confirmLabel?: string;
  /** Text on the cancel button. Defaults to `"Cancel"`. */
  cancelLabel?: string;

  /** `"danger"` → red confirm button; `"default"` → forest-colored. */
  tone?: "default" | "danger";

  /** Show a reason textarea. Confirm is disabled until it has non-empty trimmed text. */
  requireReason?: boolean;
  /** Label above the textarea. */
  reasonLabel?: string;
  /** Placeholder inside the textarea. */
  reasonPlaceholder?: string;

  /**
   * If provided, the user must type this exact string (e.g. `"DELETE"`) into
   * an acknowledgement input before confirm becomes enabled. Useful for
   * destructive operations.
   */
  requireTypedAck?: string;

  /**
   * Called when the user clicks confirm. Receives the reason text when
   * `requireReason` is on, otherwise `undefined`. May return a promise.
   */
  onConfirm: (reason?: string) => Promise<void> | void;

  /** Shows a loading state and blocks close/confirm while true. */
  loading?: boolean;
}

/**
 * Generic confirmation dialog for admin flows. Supports three optional gates:
 *
 *   - `requireReason` — adds a textarea; confirm disabled until non-empty.
 *   - `requireTypedAck` — adds a "type X to confirm" input; confirm disabled
 *     until typed value matches exactly.
 *   - `loading` — forces disabled state and prevents close via backdrop/Esc.
 *
 * Styling follows the existing admin modals (see `pages/admin/requests.tsx`):
 * fixed overlay, `bg-forest-900/50 backdrop-blur-sm`, centered
 * `rounded-2xl bg-white p-8 shadow-2xl` panel, `rose-600/700` for danger tone,
 * `forest-500/-600` for default tone.
 */
export function ConfirmActionDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  requireReason = false,
  reasonLabel,
  reasonPlaceholder,
  requireTypedAck,
  onConfirm,
  loading = false,
}: ConfirmActionDialogProps) {
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");

  // Reset fields whenever the dialog transitions to open.
  useEffect(() => {
    if (open) {
      setReason("");
      setTyped("");
    }
  }, [open]);

  // Escape closes (unless loading). Body scroll lock while open.
  useEffect(() => {
    if (!open) return;

    const prevOverflow = typeof document !== "undefined" ? document.body.style.overflow : "";
    if (typeof document !== "undefined") {
      document.body.style.overflow = "hidden";
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      if (typeof document !== "undefined") {
        document.body.style.overflow = prevOverflow;
      }
    };
  }, [open, loading, onClose]);

  if (!open) return null;

  const typedOk = !requireTypedAck || typed === requireTypedAck;
  const reasonOk = !requireReason || reason.trim().length > 0;
  const disabled = loading || !typedOk || !reasonOk;

  const confirmClass =
    tone === "danger"
      ? "inline-flex flex-1 items-center justify-center rounded-xl bg-rose-600 px-6 py-3 font-body text-sm font-semibold text-white transition-all hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      : "inline-flex flex-1 items-center justify-center rounded-xl bg-forest-500 px-6 py-3 font-body text-sm font-semibold text-white transition-all hover:bg-forest-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";

  const cancelClass =
    "inline-flex flex-1 items-center justify-center rounded-xl border border-sage-300 bg-white px-6 py-3 font-body text-sm font-semibold text-forest-700 transition-all hover:bg-cream-50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";

  const handleBackdropClick = () => {
    if (!loading) onClose();
  };

  const handleConfirm = async () => {
    if (disabled) return;
    await onConfirm(requireReason ? reason : undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-action-title"
    >
      <div
        className="absolute inset-0 bg-forest-900/50 backdrop-blur-sm"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      <div
        className="relative w-full max-w-md animate-fade-in-up rounded-2xl bg-white p-8 shadow-2xl"
      >
        <button
          type="button"
          onClick={() => {
            if (!loading) onClose();
          }}
          disabled={loading}
          className="absolute right-4 top-4 rounded-lg p-1 text-sage-400 transition-colors hover:text-forest-700 disabled:opacity-50"
          aria-label={cancelLabel}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 id="confirm-action-title" className="font-heading text-xl font-semibold text-forest-800">
          {title}
        </h3>

        {description && (
          <p className="mt-2 font-body text-sm text-forest-700/80">{description}</p>
        )}

        {requireReason && (
          <div className="mt-4">
            {reasonLabel && (
              <label
                htmlFor="confirm-action-reason"
                className="block font-body text-xs font-semibold uppercase tracking-wide text-forest-700"
              >
                {reasonLabel}
              </label>
            )}
            <textarea
              id="confirm-action-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              disabled={loading}
              rows={3}
              className="mt-1 w-full rounded-xl border border-sage-300 bg-white px-3 py-2 font-body text-sm text-forest-800 placeholder:text-sage-400 focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-500/20 disabled:opacity-50"
            />
          </div>
        )}

        {requireTypedAck && (
          <div className="mt-4">
            <label
              htmlFor="confirm-action-ack"
              className="block font-body text-xs font-semibold uppercase tracking-wide text-forest-700"
            >
              Type <span className="font-mono text-rose-600">{requireTypedAck}</span> to confirm
            </label>
            <input
              id="confirm-action-ack"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={loading}
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-sage-300 bg-white px-3 py-2 font-body text-sm text-forest-800 focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-500/20 disabled:opacity-50"
            />
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className={cancelClass}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={disabled}
            className={confirmClass}
          >
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmActionDialog;
