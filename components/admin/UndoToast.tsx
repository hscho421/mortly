import { useEffect, useRef, useState } from "react";

/**
 * 3-second "undo" toast used for admin destructive actions (Inbox approve/reject).
 * Instead of blocking with a confirm() dialog, we commit optimistically and
 * show this toast so the admin can Esc/click-undo within the grace period.
 *
 * If `onCommit` is called the toast dismisses and the commit is final.
 * If `onUndo` fires (toast closed via button or Esc) the commit is rolled back.
 */
export interface UndoToastProps {
  label: string;
  /** ms before auto-commit. Defaults to 3000. */
  graceMs?: number;
  onCommit: () => void | Promise<void>;
  onUndo: () => void;
}

export default function UndoToast({ label, graceMs = 3000, onCommit, onUndo }: UndoToastProps) {
  const [remaining, setRemaining] = useState(graceMs);
  const committedRef = useRef(false);

  useEffect(() => {
    const tickMs = 50;
    const id = setInterval(() => {
      setRemaining((r) => {
        const next = Math.max(0, r - tickMs);
        if (next === 0 && !committedRef.current) {
          committedRef.current = true;
          void onCommit();
          clearInterval(id);
        }
        return next;
      });
    }, tickMs);
    return () => clearInterval(id);
  }, [onCommit]);

  // Esc cancels
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !committedRef.current) {
        committedRef.current = true; // prevent late commit after undo
        onUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onUndo]);

  const handleUndo = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onUndo();
  };

  const pct = 100 * (remaining / graceMs);

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[360px] bg-forest-800 text-cream-100 border border-forest-700 rounded-sm shadow-xl overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="font-display text-amber-500">✓</span>
        <span className="flex-1 text-[13px]">{label}</span>
        <button
          type="button"
          onClick={handleUndo}
          className="font-mono text-[11px] uppercase tracking-[0.1em] text-amber-500 hover:text-amber-400"
        >
          실행 취소
          <span className="ml-1 text-cream-100/50">({Math.ceil(remaining / 1000)}s)</span>
        </button>
      </div>
      <div className="h-0.5 bg-forest-700">
        <div
          className="h-full bg-amber-500 transition-[width] duration-[50ms] ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
