import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import type { RequestWithIntroductions } from "@/types";

function formatCurrency(val: number | null | undefined) {
  if (val == null) return "--";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(val);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function displayLabel(val: string | null | undefined) {
  if (!val) return "--";
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
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
        if (!res.ok) throw new Error("Failed to fetch requests");
        const data = await res.json();
        setRequests(data);
      } catch {
        setError("Failed to load your requests.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
  }, [session, status, router]);

  if (status === "loading" || isLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-body-sm">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
          <div>
            <h1 className="heading-lg">{t("borrowerDashboard.title")}</h1>
            <p className="text-body mt-2">
              Track and manage all your mortgage requests in one place.
            </p>
          </div>
          <Link href="/borrower/request/new" className="btn-amber">
            + {t("borrowerDashboard.newRequest")}
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 animate-fade-in">
            <p className="font-body text-sm text-red-700">{error}</p>
          </div>
        )}

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

              const isExpired = req.status === "EXPIRED";

              return (
                <Link
                  key={req.id}
                  href={`/borrower/request/${req.publicId}`}
                  className={`card-elevated group block transition-all animate-fade-in-up ${staggerClass} ${isExpired ? "opacity-60" : "hover:shadow-lg hover:-translate-y-0.5"}`}
                >
                  {/* Top row: type + status */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center rounded-full bg-forest-100 px-2.5 py-0.5 font-body text-xs font-semibold text-forest-700">
                      {displayLabel(req.requestType)}
                    </span>
                    <StatusBadge status={req.status} />
                  </div>

                  {/* Location */}
                  <h3 className="heading-sm mb-1 group-hover:text-forest-900 transition-colors">
                    {req.city ? `${req.city}, ` : ""}
                    {req.province || "--"}
                  </h3>

                  {/* Property type */}
                  <p className="text-body-sm mb-4">
                    {displayLabel(req.propertyType)}
                  </p>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-2 mb-4">
                    <div>
                      <span className="font-body text-[11px] font-medium uppercase tracking-wider text-forest-700/50">
                        {t("request.priceRange")}
                      </span>
                      <p className="font-body text-sm font-medium text-forest-800">
                        {formatCurrency(req.priceRangeMin)} -{" "}
                        {formatCurrency(req.priceRangeMax)}
                      </p>
                    </div>
                    <div>
                      <span className="font-body text-[11px] font-medium uppercase tracking-wider text-forest-700/50">
                        {t("request.mortgageAmount")}
                      </span>
                      <p className="font-body text-sm font-medium text-forest-800">
                        {formatCurrency(req.mortgageAmountMin)} -{" "}
                        {formatCurrency(req.mortgageAmountMax)}
                      </p>
                    </div>
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
