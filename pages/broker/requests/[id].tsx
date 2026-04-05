import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import Layout from "@/components/Layout";
import ReportButton from "@/components/ReportButton";
import type { RequestWithIntroductions, ResidentialDetails, CommercialDetails } from "@/types";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import nextI18NextConfig from "@/next-i18next.config.js";
import type { GetStaticProps, GetStaticPaths } from "next";
import { PRODUCT_LABEL_KEYS, INCOME_TYPE_LABEL_KEYS, TIMELINE_LABEL_KEYS } from "@/lib/requestConfig";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function BrokerRequestDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const { t } = useTranslation("common");

  const [request, setRequest] = useState<RequestWithIntroductions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [brokerCredits, setBrokerCredits] = useState<number | null>(null);
  const [brokerTier, setBrokerTier] = useState("");

  useEffect(() => {
    if (status === "loading" || !id) return;
    if (!session || session.user.role !== "BROKER") {
      router.push("/login", undefined, { locale: router.locale });
      return;
    }

    const fetchRequest = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/requests/${id}`);
        if (!res.ok) throw new Error(t("common.failedToLoad"));
        const data = await res.json();
        setRequest(data);
      } catch {
        setError(t("common.failedToLoad"));
      } finally {
        setIsLoading(false);
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
  }, [session, status, router, id]);

  if (status === "loading" || isLoading) {
    return (
      <Layout>
        <Head><title>{t("broker.requestDetails")}</title></Head>
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-body-sm">{t("common.loading")}</p>
        </div>
      </Layout>
    );
  }

  if (!session || session.user.role !== "BROKER") {
    return null;
  }

  if (error || !request) {
    return (
      <Layout>
        <Head><title>{t("broker.requestDetails")}</title></Head>
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-xl bg-error-50 border border-error-500/20 p-4" role="alert">
            <p className="font-body text-sm text-error-700">{error || t("misc.requestNotFound")}</p>
          </div>
          <Link
            href="/broker/requests"
            className="mt-4 inline-flex items-center gap-1 font-body text-sm font-medium text-forest-600 hover:text-forest-800 transition-colors"
          >
            &larr; {t("broker.backToRequests")}
          </Link>
        </div>
      </Layout>
    );
  }

  const hasResponded = request.introductions
    ? request.introductions.some(
        (intro) => intro.broker?.userId === session.user.id
      )
    : (request._count?.introductions ?? 0) > 0;

  const statusColors: Record<string, string> = {
    OPEN: "bg-forest-100 text-forest-700",
    IN_PROGRESS: "bg-amber-100 text-amber-700",
    EXPIRED: "bg-sage-100 text-sage-600",
    CLOSED: "bg-sage-100 text-sage-700",
  };

  return (
    <Layout>
      <Head><title>{t("broker.requestDetails")}</title></Head>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 animate-fade-in">
        <Link
          href="/broker/requests"
          className="mb-8 inline-flex items-center gap-1 font-body text-sm font-medium text-forest-600 hover:text-forest-800 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          {t("request.backToRequests")}
        </Link>

        <div className="card-elevated animate-fade-in-up">
          {/* Header badges */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${
              request.mortgageCategory === "COMMERCIAL"
                ? "bg-amber-100 text-amber-800"
                : "bg-forest-100 text-forest-700"
            }`}>
              {request.mortgageCategory === "COMMERCIAL"
                ? t("request.commercial")
                : t("request.residential")}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${statusColors[request.status] || "bg-sage-100 text-sage-700"}`}>
              {t(`statusLabel.${request.status}`, request.status)}
            </span>
          </div>

          <div className="flex items-start justify-between gap-3">
            <h1 className="heading-lg mb-2">
              {`${request.mortgageCategory === "COMMERCIAL" ? t("request.commercial") : t("request.residential")} — ${request.city ? `${request.city}, ` : ""}${request.province}`}
            </h1>
            <ReportButton targetType="REQUEST" targetId={request.publicId} />
          </div>
          <p className="text-body-sm mb-8">
            {t("misc.posted", { date: formatDate(request.createdAt as unknown as string) })} &middot;{" "}
            {t("misc.brokerResponses", { count: request._count?.introductions ?? 0 })}
          </p>

          <hr className="divider mb-8" />

          {/* Product pills */}
          <div className="mb-6">
            <h3 className="font-body text-xs font-medium uppercase tracking-wider text-forest-700/50 mb-3">
              {t("request.selectProducts")}
            </h3>
            <div className="flex flex-wrap gap-2">
              {(request.productTypes ?? []).map((pt) => (
                <span
                  key={pt}
                  className="inline-flex items-center rounded-full bg-cream-200 px-3 py-1 font-body text-sm font-medium text-forest-700"
                >
                  {t(PRODUCT_LABEL_KEYS[pt] ?? pt)}
                </span>
              ))}
            </div>
          </div>

          {/* Category-specific details */}
          <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {request.mortgageCategory === "COMMERCIAL" ? (
              <>
                {(() => {
                  const d = request.details as CommercialDetails | null;
                  return d ? (
                    <>
                      <div className="rounded-xl bg-cream-100 p-4">
                        <h3 className="font-body text-xs font-medium uppercase tracking-wider text-forest-700/50">{t("request.businessType")}</h3>
                        <p className="mt-1 font-body text-sm font-medium text-forest-800">{d.businessType || t("request.notSpecified")}</p>
                      </div>
                      <div className="rounded-xl bg-cream-100 p-4 col-span-full">
                        <h3 className="font-body text-xs font-medium uppercase tracking-wider text-forest-700/50 mb-2">{t("request.corporateFinancials")}</h3>
                        {typeof d.corporateAnnualIncome === "object" ? (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-cream-200">
                                <th className="font-body font-medium text-sage-500 text-left py-1 pr-4">{t("request.selectYear")}</th>
                                <th className="font-body font-medium text-sage-500 text-right py-1 px-4">{t("request.corpIncome")}</th>
                                <th className="font-body font-medium text-sage-500 text-right py-1 pl-4">{t("request.corpExpenses")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.keys(d.corporateAnnualIncome || {}).sort().reverse().map((year) => (
                                <tr key={year} className="border-b border-cream-100 last:border-0">
                                  <td className="font-body text-forest-800 py-1.5 pr-4">{year}</td>
                                  <td className="font-body font-medium text-forest-800 text-right py-1.5 px-4">${(d.corporateAnnualIncome as Record<string, string>)[year] || "—"}</td>
                                  <td className="font-body font-medium text-forest-800 text-right py-1.5 pl-4">${((d.corporateAnnualExpenses as Record<string, string>) || {})[year] || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="font-body text-sm text-forest-800">{t("request.notSpecified")}</p>
                        )}
                      </div>
                      <div className="rounded-xl bg-cream-100 p-4">
                        <h3 className="font-body text-xs font-medium uppercase tracking-wider text-forest-700/50">{t("request.ownerNetIncome")}</h3>
                        <p className="mt-1 font-body text-sm font-medium text-forest-800">{d.ownerNetIncome ? `$${d.ownerNetIncome}` : t("request.notSpecified")}</p>
                      </div>
                    </>
                  ) : null;
                })()}
              </>
            ) : (
              <>
                {(() => {
                  const d = request.details as ResidentialDetails | null;
                  return d ? (
                    <>
                      <div className="rounded-xl bg-cream-100 p-4">
                        <h3 className="font-body text-xs font-medium uppercase tracking-wider text-forest-700/50">{t("request.purposeOfUse")}</h3>
                        <p className="mt-1 font-body text-sm font-medium text-forest-800">
                          {Array.isArray(d.purposeOfUse)
                            ? d.purposeOfUse.map((v) => v === "OWNER_OCCUPIED" ? t("request.ownerOccupied") : t("request.rental")).join(", ")
                            : d.purposeOfUse === "OWNER_OCCUPIED" ? t("request.ownerOccupied") : t("request.rental")}
                        </p>
                      </div>
                      <div className="rounded-xl bg-cream-100 p-4">
                        <h3 className="font-body text-xs font-medium uppercase tracking-wider text-forest-700/50">{t("request.incomeType")}</h3>
                        <p className="mt-1 font-body text-sm font-medium text-forest-800">
                          {(d.incomeTypes ?? []).map((it) => t(INCOME_TYPE_LABEL_KEYS[it] ?? it)).join(", ")}
                          {d.incomeTypeOther ? ` (${d.incomeTypeOther})` : ""}
                        </p>
                      </div>
                      <div className="rounded-xl bg-cream-100 p-4">
                        <h3 className="font-body text-xs font-medium uppercase tracking-wider text-forest-700/50 mb-2">{t("request.annualIncome")}</h3>
                        {typeof d.annualIncome === "object" && d.annualIncome ? (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-cream-200">
                                <th className="font-body font-medium text-sage-500 text-left py-1 pr-4">{t("request.selectYear")}</th>
                                <th className="font-body font-medium text-sage-500 text-right py-1">{t("request.annualIncome")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(d.annualIncome).sort(([a], [b]) => b.localeCompare(a)).map(([year, amount]) => (
                                <tr key={year} className="border-b border-cream-100 last:border-0">
                                  <td className="font-body text-forest-800 py-1.5 pr-4">{year}</td>
                                  <td className="font-body font-medium text-forest-800 text-right py-1.5">${amount || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="mt-1 font-body text-sm font-medium text-forest-800">{(d.annualIncome as unknown as string) || t("request.notSpecified")}</p>
                        )}
                      </div>
                    </>
                  ) : null;
                })()}
              </>
            )}
            {request.desiredTimeline && (
              <div className="rounded-xl bg-cream-100 p-4">
                <h3 className="font-body text-xs font-medium uppercase tracking-wider text-forest-700/50">{t("request.desiredTimeline")}</h3>
                <p className="mt-1 font-body text-sm font-medium text-forest-800">{t(TIMELINE_LABEL_KEYS[request.desiredTimeline] || request.desiredTimeline)}</p>
              </div>
            )}
          </div>

          {request.notes && (
            <div className="mb-8 rounded-xl bg-cream-100 p-5">
              <h3 className="font-body text-xs font-medium uppercase tracking-wider text-forest-700/50">{t("request.additionalNotes")}</h3>
              <p className="mt-2 font-body text-sm text-forest-800 whitespace-pre-wrap">{request.notes}</p>
            </div>
          )}

          {/* CTA */}
          {hasResponded ? (
            <div className="rounded-xl bg-forest-50 border border-forest-200 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-forest-200 p-1.5">
                  <svg className="h-4 w-4 text-forest-700" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="font-body text-sm font-medium text-forest-800">
                  {t("broker.alreadySubmitted")}
                </p>
              </div>
            </div>
          ) : (brokerTier === "BASIC" || brokerTier === "PRO") && brokerCredits === 0 ? (
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200">
                    <svg className="h-4 w-4 text-amber-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                  </div>
                  <p className="font-body text-sm font-medium text-forest-800">{t("credits.noCreditsIntro")}</p>
                </div>
                <Link href="/broker/billing" className="btn-amber shrink-0 text-center">
                  {t("credits.upgradePlan")}
                </Link>
              </div>
            </div>
          ) : (
            <Link
              href={`/broker/introduction/new?requestId=${request.publicId}`}
              className="btn-primary w-full sm:w-auto text-center"
            >
              {t("broker.submitIntroduction")}
            </Link>
          )}
        </div>
      </div>
    </Layout>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [],
  fallback: "blocking",
});

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"], nextI18NextConfig)),
  },
});
