import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import posthog from "posthog-js";

const CONSENT_KEY = "mortly:analytics-consent";

/**
 * PIPEDA / Quebec Law 25 analytics consent banner.
 *
 * PostHog boots opted-out + memory-only (see instrumentation-client.ts).
 * - Accept → switch persistence to localStorage and opt in.
 * - Decline → stay cookieless/opted-out (the default), just remember the choice.
 *
 * The decision is stored in localStorage so the banner doesn't reappear.
 * On reload, an accepted choice re-opts-in (init starts opted-out every time).
 */
export default function ConsentBanner() {
  const { t } = useTranslation("common");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let choice: string | null = null;
    try {
      choice = localStorage.getItem(CONSENT_KEY);
    } catch {
      // Storage blocked (private mode) — show the banner; treat as session-only.
    }
    if (choice === "accepted") {
      // Re-grant on return visits (init always starts opted-out).
      posthog.set_config({ persistence: "localStorage+cookie" });
      posthog.opt_in_capturing();
    } else if (choice !== "declined") {
      setVisible(true);
    }
  }, []);

  const persist = (value: "accepted" | "declined") => {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // ignore
    }
  };

  const accept = () => {
    persist("accepted");
    posthog.set_config({ persistence: "localStorage+cookie" });
    posthog.opt_in_capturing();
    setVisible(false);
  };

  const decline = () => {
    persist("declined");
    posthog.opt_out_capturing();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label={t("consent.title", "Analytics consent")}
      className="fixed inset-x-0 bottom-0 z-[80] border-t border-cream-300 bg-cream-50/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="font-body text-[13px] leading-relaxed text-forest-700/80">
          {t(
            "consent.body",
            "We use privacy-friendly analytics to improve mortly. You can decline without affecting your experience.",
          )}{" "}
          <Link href="/privacy" className="underline hover:text-forest-800">
            {t("consent.learnMore", "Privacy policy")}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={decline}
            className="rounded-sm border border-cream-300 bg-white px-4 py-2 font-body text-[13px] font-medium text-forest-700 transition-colors hover:bg-cream-200"
          >
            {t("consent.decline", "Decline")}
          </button>
          <button
            onClick={accept}
            className="rounded-sm bg-forest-800 px-4 py-2 font-body text-[13px] font-semibold text-cream-100 transition-colors hover:bg-forest-700"
          >
            {t("consent.accept", "Accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
