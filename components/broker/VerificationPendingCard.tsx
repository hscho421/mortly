import { useTranslation } from "next-i18next";
import { Btn } from "@/components/broker/ui";

/**
 * Shown to a broker whose profile isn't verified yet, in place of the request
 * feed (the marketplace is gated until admin approval). Single source of truth
 * for that message — used on the full /broker/requests page (with the dashboard
 * CTA) and inside the dashboard's request panel (without it, since you're
 * already on the dashboard). All copy is i18n (broker.* keys + nav.dashboard).
 */
export default function VerificationPendingCard({
  showDashboardLink = false,
}: {
  /** Render the "go to dashboard" button (off when already on the dashboard). */
  showDashboardLink?: boolean;
}) {
  const { t } = useTranslation("common");
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-amber-100">
        <svg
          className="h-7 w-7 text-amber-700"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
          />
        </svg>
      </div>
      <div className="font-display text-2xl font-semibold text-forest-800">
        {t("broker.verificationRequired", "Verification Required")}
      </div>
      <p className="mx-auto mt-3 max-w-md font-body text-[14px] text-forest-700/80">
        {t(
          "broker.verificationRequiredDesc",
          "Your broker profile must be verified before you can browse borrower requests. Please wait for admin approval.",
        )}
      </p>
      <p className="mx-auto mt-2 max-w-md font-body text-[12px] text-sage-500">
        {t("broker.verificationTimeline")}
      </p>
      <p
        className={`mx-auto mt-1 max-w-md font-body text-[12px] text-sage-500 ${
          showDashboardLink ? "mb-6" : ""
        }`}
      >
        {t("broker.contactSupport")}{" "}
        <a
          href="mailto:support@mortly.ca"
          className="text-forest-700 underline hover:text-forest-900"
        >
          support@mortly.ca
        </a>
      </p>
      {showDashboardLink && (
        <Btn as="a" href="/broker/dashboard">
          {t("nav.dashboard")}
        </Btn>
      )}
    </div>
  );
}
