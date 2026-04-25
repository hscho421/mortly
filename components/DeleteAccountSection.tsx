import { useState } from "react";
import { useRouter } from "next/router";
import { signOut } from "next-auth/react";
import { useTranslation } from "next-i18next";

/**
 * Apple App Store guideline 5.1.1(v) requires in-app account deletion that is:
 * - irreversible
 * - clearly communicated
 * - multi-step confirmed
 *
 * Drop into any settings/profile page where authenticated users land.
 * Two-step modal mirrors the mobile flow (two sequential native Alerts).
 */
export default function DeleteAccountSection() {
  const { t } = useTranslation("common");
  const router = useRouter();

  // null = closed, "first" = showing initial confirm, "second" = showing final confirm
  const [stage, setStage] = useState<null | "first" | "second">(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setError("");
    setDeleting(true);
    try {
      const res = await fetch("/api/users/me", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.message || t("settings.deleteAccountFailed"));
      }
      // Server has wiped the account; sign out the NextAuth session and redirect.
      // signOut clears cookies/tokens and routes to the callback URL.
      await signOut({ callbackUrl: "/", redirect: false });
      router.push("/", undefined, { locale: router.locale });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("settings.deleteAccountFailed"));
      setStage(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Section card — visually separated from other settings */}
      <div className="card-elevated mt-8 border-2 border-error-100 bg-error-50/30">
        <h2 className="heading-sm mb-2 text-error-700">{t("settings.dangerZone")}</h2>
        <p className="text-body-sm text-sage-500 mb-5">
          {t("settings.deleteAccountDesc")}
        </p>
        <button
          type="button"
          onClick={() => setStage("first")}
          disabled={deleting}
          className="rounded-full border border-error-300 bg-white px-5 py-2 font-body text-sm font-semibold text-error-700 transition-colors hover:bg-error-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("settings.deleteAccount")}
        </button>
        {error ? (
          <p className="mt-3 text-body-sm text-error-600">{error}</p>
        ) : null}
      </div>

      {/* First confirmation modal */}
      {stage === "first" && (
        <ConfirmModal
          title={t("settings.deleteAccountConfirmTitle")}
          description={t("settings.deleteAccountConfirmDesc")}
          cancelLabel={t("settings.deleteAccountCancel")}
          confirmLabel={t("settings.deleteAccountConfirm")}
          onCancel={() => setStage(null)}
          onConfirm={() => setStage("second")}
          deleting={false}
        />
      )}

      {/* Second confirmation modal — final step before the destructive call */}
      {stage === "second" && (
        <ConfirmModal
          title={t("settings.deleteAccountSecondConfirmTitle")}
          description={t("settings.deleteAccountSecondConfirmDesc")}
          cancelLabel={t("settings.deleteAccountCancel")}
          confirmLabel={
            deleting
              ? t("settings.deleteAccountDeleting")
              : t("settings.deleteAccountConfirm")
          }
          onCancel={() => (deleting ? undefined : setStage(null))}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}
    </>
  );
}

interface ConfirmModalProps {
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
}

function ConfirmModal({
  title,
  description,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  deleting,
}: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => (deleting ? undefined : onCancel())}
    >
      <div
        className="w-full max-w-md rounded-sm bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="heading-sm mb-2">{title}</h3>
        <p className="text-body-sm text-sage-500 mb-6">{description}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-full border border-cream-300 bg-white px-5 py-2 font-body text-sm font-semibold text-forest-700 transition-colors hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-full bg-error-600 px-5 py-2 font-body text-sm font-semibold text-white transition-colors hover:bg-error-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
