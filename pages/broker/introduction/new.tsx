import { useState, useEffect, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "@/components/Layout";
import type { BorrowerRequest } from "@/types";
import type { CreateIntroductionInput } from "@/types";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import { PRODUCT_LABEL_KEYS, TIMELINE_LABEL_KEYS } from "@/lib/requestConfig";

export default function NewIntroductionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { requestId } = router.query;
  const { t } = useTranslation("common");

  const [request, setRequest] = useState<BorrowerRequest | null>(null);
  const [isLoadingRequest, setIsLoadingRequest] = useState(true);
  const [brokerCredits, setBrokerCredits] = useState<number | null>(null);
  const [brokerTier, setBrokerTier] = useState("");

  const [form, setForm] = useState<Omit<CreateIntroductionInput, "requestId">>({
    message: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === "loading" || !requestId) return;
    if (!session || session.user.role !== "BROKER") {
      router.push("/login", undefined, { locale: router.locale });
      return;
    }

    const fetchRequest = async () => {
      setIsLoadingRequest(true);
      try {
        const res = await fetch(`/api/requests/${requestId}`);
        if (!res.ok) throw new Error(t("common.failedToLoad"));
        const data = await res.json();
        setRequest(data);
      } catch {
        setError(t("common.failedToLoad"));
      } finally {
        setIsLoadingRequest(false);
      }
    };

    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/brokers/profile");
        if (res.ok) {
          const data = await res.json();
          setBrokerCredits(data.responseCredits ?? 0);
          setBrokerTier(data.subscriptionTier || "");
        }
      } catch {
        // ignore
      }
    };

    fetchRequest();
    fetchProfile();
  }, [session, status, router, requestId]);

  const noCredits =
    (brokerTier === "BASIC" || brokerTier === "PRO") && brokerCredits === 0;

  if (status === "loading") {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-body-sm">{t("common.loading")}</p>
        </div>
      </Layout>
    );
  }

  if (!session || session.user.role !== "BROKER") {
    return null;
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const payload: CreateIntroductionInput = {
        ...form,
        requestId: requestId as string,
      };

      const res = await fetch("/api/introductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || data.message || t("common.somethingWentWrong"));
        setIsSubmitting(false);
        return;
      }

      router.push("/broker/requests", undefined, { locale: router.locale });
    } catch {
      setError(t("common.unexpectedError"));
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <Link
          href="/broker/requests"
          className="mb-8 inline-flex items-center gap-1 font-body text-sm font-medium text-forest-600 hover:text-forest-800 transition-colors animate-fade-in"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          {t("request.backToRequests")}
        </Link>

        <div className="mb-8 animate-fade-in">
          <h1 className="heading-lg mb-2">{t("broker.myIntroductions")}</h1>
          <p className="text-body">
            {t("broker.introSubtitle")}
          </p>
        </div>

        {/* Request summary */}
        {isLoadingRequest ? (
          <div className="mb-8 rounded-2xl bg-cream-200/50 border border-cream-300 p-6 animate-fade-in">
            <p className="text-body-sm">Loading request details...</p>
          </div>
        ) : request ? (
          <div className="mb-8 rounded-2xl bg-cream-200/50 border border-cream-300 p-6 animate-fade-in-up stagger-1">
            <h2 className="mb-3 font-body text-xs font-semibold uppercase tracking-wider text-forest-700/50">
              {t("broker.requestSummary")}
            </h2>
            <p className="heading-sm">
              {request.mortgageCategory === "COMMERCIAL"
                ? t("request.commercial")
                : t("request.residential")}{" "}
              — {request.city ? `${request.city}, ` : ""}
              {request.province}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(request.productTypes ?? []).map((pt) => (
                <span
                  key={pt}
                  className="inline-flex items-center rounded-full bg-cream-300 px-2 py-0.5 font-body text-xs font-medium text-forest-700"
                >
                  {t(PRODUCT_LABEL_KEYS[pt] ?? pt)}
                </span>
              ))}
            </div>
            {request.desiredTimeline && (
              <div className="mt-3">
                <span className="font-body text-xs font-medium text-forest-700/50">{t("request.desiredTimeline")}</span>
                <p className="font-body text-sm text-forest-800">{t(TIMELINE_LABEL_KEYS[request.desiredTimeline!] || request.desiredTimeline!)}</p>
              </div>
            )}
          </div>
        ) : null}

        {noCredits && (
          <div className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 animate-fade-in">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-200">
                <svg className="h-5 w-5 text-amber-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
              </div>
              <div>
                <h3 className="font-body text-sm font-semibold text-forest-800">{t("credits.noCreditsTitle")}</h3>
                <p className="mt-1 font-body text-sm text-forest-700/70">{t("credits.noCreditsIntro")}</p>
                <Link
                  href="/broker/billing"
                  className="mt-3 inline-flex items-center gap-1 font-body text-sm font-semibold text-amber-700 hover:text-amber-800 transition-colors"
                >
                  {t("credits.goToBilling")} &rarr;
                </Link>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl bg-error-50 border border-error-500/20 p-4 animate-fade-in" role="alert">
            <p className="font-body text-sm text-error-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="card-elevated space-y-6 animate-fade-in-up stagger-2">
          <div>
            <label htmlFor="message" className="label-text">
              {t("broker.introMessageLabel")} <span className="text-amber-600">*</span>
            </label>
            <p className="font-body text-sm text-forest-700/60 mt-1 mb-3 whitespace-pre-line">
              {t("broker.introMessageHint")}
            </p>
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mb-3">
              <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <p className="font-body text-sm font-semibold text-amber-800">
                {t("broker.introMessageTip")}
              </p>
            </div>
            <textarea
              id="message"
              name="message"
              rows={10}
              required
              value={form.message}
              onChange={handleChange}
              className="input-field resize-none"
              placeholder={t("broker.introMessagePlaceholder")}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !!noCredits}
            className="btn-amber w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? t("broker.saving") : t("broker.save")}
          </button>
        </form>
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});
