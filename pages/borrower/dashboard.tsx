import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { SkeletonDashboard } from "@/components/Skeleton";
import type { RequestWithIntroductions } from "@/types";
import { PRODUCT_LABEL_KEYS } from "@/lib/requestConfig";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});

export default function BorrowerDashboard() {
  const { t } = useTranslation("common");
  const { data: session, status } = useSession();
  const router = useRouter();

  const [requests, setRequests] = useState<RequestWithIntroductions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/login", undefined, { locale: router.locale });
      return;
    }

    const fetchRequests = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/requests");
        if (!res.ok) throw new Error(t("borrowerDashboard.failedToFetch"));
        const json = await res.json();
        setRequests(json.data ?? json);
      } catch {
        setError(t("borrowerDashboard.failedToLoad"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
  }, [session, status, router]);

  if (status === "loading" || isLoading) {
    return (
      <Layout>
        <SkeletonDashboard />
      </Layout>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <Layout>
      <Head><title>{t("titles.borrowerDashboard")}</title></Head>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
          <div>
            <h1 className="heading-lg">{t("borrowerDashboard.title")}</h1>
            <p className="text-body mt-2">
              {t("borrowerDashboard.subtitle")}
            </p>
          </div>
          <Link href="/borrower/request/new" className="btn-amber">
            + {t("borrowerDashboard.newRequest")}
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-error-50 border border-error-500/20 p-4 animate-fade-in" role="alert">
            <p className="font-body text-sm text-error-700">{error}</p>
          </div>
        )}

        {/* Stats row */}
        {requests.length > 0 && (() => {
          const activeCount = requests.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS").length;
          const totalIntros = requests.reduce((sum, r) => sum + (r._count?.introductions ?? r.introductions?.length ?? 0), 0);
          return (
            <div className="mb-10 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {[
                { value: requests.length, label: t("borrowerDashboard.statTotal", "Total Requests") },
                { value: activeCount, label: t("borrowerDashboard.statActive", "Active") },
                { value: totalIntros, label: t("borrowerDashboard.statOffers", "Offers Received") },
                { value: requests.filter((r) => r.status === "CLOSED").length, label: t("borrowerDashboard.statCompleted", "Completed") },
              ].map((stat, i) => (
                <div key={i} className={`card-stat text-center animate-fade-in-up stagger-${i + 1}`}>
                  <p className="font-display text-3xl text-forest-800 mb-1">{stat.value}</p>
                  <p className="text-body-sm">{stat.label}</p>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Request list */}
        {requests.length === 0 ? (
          <div className="card-elevated text-center py-16 animate-fade-in-up stagger-1">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-cream-200">
              <svg
                className="h-8 w-8 text-forest-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
            </div>
            <h2 className="heading-md mb-2">{t("borrowerDashboard.noRequests")}</h2>
            <p className="text-body mb-6 max-w-md mx-auto">
              {t("borrowerDashboard.noRequestsDesc")}
            </p>
            <Link href="/borrower/request/new" className="btn-amber">
              {t("borrowerDashboard.createFirst")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            {requests.map((req, i) => {
              const staggerClass =
                i < 6 ? `stagger-${i + 1}` : "stagger-6";
              const introCount =
                req._count?.introductions ?? req.introductions?.length ?? 0;

              const isDimmed = req.status === "EXPIRED" || req.status === "REJECTED";

              return (
                <Link
                  key={req.id}
                  href={`/borrower/request/${req.publicId}`}
                  className={`card-elevated group block transition-all animate-fade-in-up ${staggerClass} ${isDimmed ? "opacity-60" : "hover:shadow-lg hover:-translate-y-0.5"}`}
                >
                  {/* Top row: type + status */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${
                      req.mortgageCategory === "COMMERCIAL"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-forest-100 text-forest-700"
                    }`}>
                      {req.mortgageCategory === "COMMERCIAL"
                        ? t("request.commercial")
                        : t("request.residential")}
                    </span>
                    <StatusBadge status={req.status} />
                  </div>

                  {/* Status notes */}
                  {req.status === "PENDING_APPROVAL" && (
                    <p className="font-body text-xs text-amber-600 mb-2">
                      {t("request.pendingApprovalNote", "Your request is under review.")}
                    </p>
                  )}
                  {req.status === "REJECTED" && (
                    <p className="font-body text-xs text-rose-600 mb-2">
                      {t("request.rejectedNote", "This request was not approved.")}
                    </p>
                  )}

                  {/* Location */}
                  <h3 className="heading-sm mb-1 group-hover:text-forest-900 transition-colors">
                    {req.city ? `${req.city}, ` : ""}
                    {req.province || "--"}
                  </h3>

                  {/* Product type pills */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {(req.productTypes ?? []).map((pt) => (
                      <span
                        key={pt}
                        className="inline-flex items-center rounded-full bg-cream-200 px-2 py-0.5 font-body text-[11px] font-medium text-forest-700"
                      >
                        {t(PRODUCT_LABEL_KEYS[pt] ?? pt)}
                      </span>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-cream-200">
                    <span className="text-body-sm">
                      {formatDate(req.createdAt as unknown as string)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-body text-xs font-medium text-forest-700">
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                        />
                      </svg>
                      {introCount} {introCount !== 1 ? t("borrowerDashboard.introductionsPlural") : t("borrowerDashboard.introductions")}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Expiration note */}
        {requests.length > 0 && (
          <p className="mt-8 text-center font-body text-xs text-forest-700/50">
            {t("request.expirationNote")}
          </p>
        )}
      </div>
    </Layout>
  );
}
