import { useEffect, useRef, useState } from "react";
import { useTranslation } from "next-i18next";

interface ReportButtonProps {
  targetType: string;
  targetId: string;
}

export default function ReportButton({ targetType, targetId }: ReportButtonProps) {
  const { t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Track the auto-close timeout so we can cancel it if the user closes the
  // modal manually (or if the component unmounts) — the previous code left
  // the timer running and triggered a "set state on unmounted component"
  // warning, plus a phantom close on any modal a user reopened within 2s.
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const cancelAutoClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason: reason.trim() }),
      });

      if (res.status === 201) {
        setFeedback({ type: "success", message: t("report.success") });
        setReason("");
        cancelAutoClose();
        closeTimeoutRef.current = setTimeout(() => {
          setIsOpen(false);
          setFeedback(null);
          closeTimeoutRef.current = null;
        }, 2000);
      } else if (res.status === 409) {
        setFeedback({ type: "error", message: t("report.duplicate") });
      } else {
        setFeedback({ type: "error", message: t("report.error") });
      }
    } catch {
      setFeedback({ type: "error", message: t("report.error") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Report icon button */}
      <button
        onClick={() => {
          setIsOpen(true);
          setFeedback(null);
        }}
        title={t("report.title")}
        className="inline-flex items-center justify-center rounded-lg p-1.5 text-sage-400 hover:text-amber-600 hover:bg-amber-50 transition-colors duration-200"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5"
          />
        </svg>
      </button>

      {/* Modal overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              cancelAutoClose();
              setIsOpen(false);
              setFeedback(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-fade-in-up">
            <h2 className="heading-sm mb-4">{t("report.title")}</h2>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("report.placeholder")}
              rows={4}
              className="input-field w-full resize-none"
            />

            {feedback && (
              <div
                className={`mt-3 rounded-xl p-3 font-body text-sm ${
                  feedback.type === "success"
                    ? "bg-forest-50 text-forest-700 border border-forest-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {feedback.message}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setFeedback(null);
                  setReason("");
                }}
                className="btn-secondary"
              >
                {t("messages.cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !reason.trim()}
                className="btn-amber disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "..." : t("report.submit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
