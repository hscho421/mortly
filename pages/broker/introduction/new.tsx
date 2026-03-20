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

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
}

export default function NewIntroductionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { requestId } = router.query;
  const { t } = useTranslation("common");

  const [request, setRequest] = useState<BorrowerRequest | null>(null);
  const [isLoadingRequest, setIsLoadingRequest] = useState(true);

  const [form, setForm] = useState<Omit<CreateIntroductionInput, "requestId">>({
    howCanHelp: "",
    experience: "",
    lenderNetwork: "",
    processNotes: "",
    personalMessage: "",
    estimatedTimeline: "",
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
        if (!res.ok) throw new Error("Failed to fetch request");
        const data = await res.json();
        setRequest(data);
      } catch {
        setError("Failed to load request details.");
      } finally {
        setIsLoadingRequest(false);
      }
    };

    fetchRequest();
  }, [session, status, router, requestId]);

  if (status === "loading") {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-body-sm">Loading...</p>
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
        setError(data.error || data.message || "Failed to submit introduction.");
        setIsSubmitting(false);
        return;
      }

      router.push("/broker/requests", undefined, { locale: router.locale });
    } catch {
      setError("An unexpected error occurred. Please try again.");
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
              {request.requestType} in {request.city ? `${request.city}, ` : ""}
              {request.province}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
              <div>
                <span className="font-body text-xs font-medium text-forest-700/50">{t("request.property")}</span>
                <p className="font-body text-sm text-forest-800">{request.propertyType}</p>
              </div>
              <div>
                <span className="font-body text-xs font-medium text-forest-700/50">{t("broker.price")}</span>
                <p className="font-body text-sm text-forest-800">
                  {formatCurrency(request.priceRangeMin)} - {formatCurrency(request.priceRangeMax)}
                </p>
              </div>
              <div>
                <span className="font-body text-xs font-medium text-forest-700/50">{t("broker.mortgage")}</span>
                <p className="font-body text-sm text-forest-800">
                  {formatCurrency(request.mortgageAmountMin)} - {formatCurrency(request.mortgageAmountMax)}
                </p>
              </div>
              <div>
                <span className="font-body text-xs font-medium text-forest-700/50">{t("broker.timeline")}</span>
                <p className="font-body text-sm text-forest-800">
                  {request.closingTimeline || t("request.notSpecified")}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 animate-fade-in">
            <p className="font-body text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="card-elevated space-y-6 animate-fade-in-up stagger-2">
          <div>
            <label htmlFor="howCanHelp" className="label-text">
              {t("broker.howYouCanHelp")} <span className="text-amber-600">*</span>
            </label>
            <textarea
              id="howCanHelp"
              name="howCanHelp"
              rows={4}
              required
              value={form.howCanHelp}
              onChange={handleChange}
              className="input-field resize-none"
              placeholder={t("broker.howYouCanHelpPlaceholder")}
            />
          </div>

          <div>
            <label htmlFor="experience" className="label-text">
              {t("broker.relevantExperience")}
            </label>
            <textarea
              id="experience"
              name="experience"
              rows={3}
              value={form.experience || ""}
              onChange={handleChange}
              className="input-field resize-none"
              placeholder={t("broker.relevantExpPlaceholder")}
            />
          </div>

          <div>
            <label htmlFor="lenderNetwork" className="label-text">
              {t("broker.lenderNetwork")}
            </label>
            <textarea
              id="lenderNetwork"
              name="lenderNetwork"
              rows={3}
              value={form.lenderNetwork || ""}
              onChange={handleChange}
              className="input-field resize-none"
              placeholder={t("broker.lenderNetworkPlaceholder")}
            />
          </div>

          <div>
            <label htmlFor="processNotes" className="label-text">
              {t("broker.processNotes")}
            </label>
            <textarea
              id="processNotes"
              name="processNotes"
              rows={3}
              value={form.processNotes || ""}
              onChange={handleChange}
              className="input-field resize-none"
              placeholder={t("broker.processNotesPlaceholder")}
            />
          </div>

          <hr className="divider" />

          <div>
            <label htmlFor="personalMessage" className="label-text">
              {t("broker.personalMessage")} <span className="text-amber-600">*</span>
            </label>
            <textarea
              id="personalMessage"
              name="personalMessage"
              rows={4}
              required
              value={form.personalMessage}
              onChange={handleChange}
              className="input-field resize-none"
              placeholder={t("broker.personalMessagePlaceholder")}
            />
          </div>

          <div>
            <label htmlFor="estimatedTimeline" className="label-text">
              {t("broker.estimatedTimeline")}
            </label>
            <input
              id="estimatedTimeline"
              name="estimatedTimeline"
              type="text"
              value={form.estimatedTimeline || ""}
              onChange={handleChange}
              className="input-field"
              placeholder={t("broker.estimatedTimelinePlaceholder")}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
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
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});
