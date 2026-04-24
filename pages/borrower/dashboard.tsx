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
import { UBadge, UCard, Banner } from "@/components/ui";
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

  interface DashboardRequest {
    id: string;
    publicId: string;
    province: string;
    city?: string | null;
    status: string;
    createdAt: string | Date;
    mortgageCategory?: string | null;
    productTypes?: string[] | null;
    conversations?: { broker?: { userId: string } }[];
    _count?: { conversations?: number };
  }

  const [requests, setRequests] = useState<DashboardRequest[]>([]);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, router.locale]);

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

  const activeCount = requests.filter(
    (r) => r.status === "OPEN" || r.status === "IN_PROGRESS",
  ).length;
  const totalConvos = requests.reduce(
    (sum, r) => sum + (r._count?.conversations ?? r.conversations?.length ?? 0),
    0,
  );
  const completedCount = requests.filter((r) => r.status === "CLOSED").length;

  return (
    <Layout>
      <Head><title>{t("titles.borrowerDashboard")}</title></Head>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header — editorial serif with name accent */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="eyebrow">— {t("nav.dashboard")}</div>
            <h1 className="heading-lg mt-3">
              {t("borrowerDashboard.title", { name: session.user?.name ?? "" })}
            </h1>
            <p className="text-body mt-3 max-w-2xl">
              {t("borrowerDashboard.subtitle")}
            </p>
          </div>
          <Link href="/borrower/request/new" className="btn-amber whitespace-nowrap">
            + {t("borrowerDashboard.newRequest")}
          </Link>
        </div>

        {error && (
          <Banner
            tone="danger"
            title={error}
            className="mb-6"
          />
        )}

        {/* Stats row */}
        {requests.length > 0 && (
          <div className="mb-10 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { value: requests.length, label: t("borrowerDashboard.statTotal", "Total Requests") },
              { value: activeCount, label: t("borrowerDashboard.statActive", "Active") },
              { value: totalConvos, label: t("borrowerDashboard.statOffers", "Offers Received") },
              { value: completedCount, label: t("borrowerDashboard.statCompleted", "Completed") },
            ].map((stat) => (
              <UCard key={stat.label} pad={0}>
                <div className="px-6 py-5">
                  <div className="mono-label">{stat.label}</div>
                  <div className="mt-2 font-display font-semibold text-4xl text-forest-800 tracking-[-0.03em] leading-none">
                    {stat.value}
                  </div>
                </div>
              </UCard>
            ))}
          </div>
        )}

        {/* Request list */}
        {requests.length === 0 ? (
          <UCard pad={0}>
            <div className="text-center py-16 px-6">
              <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center border border-cream-300 bg-cream-200 text-forest-600 text-xl">
                <span className="font-display">+</span>
              </div>
              <h2 className="heading-md mb-2">{t("borrowerDashboard.noRequests")}</h2>
              <p className="text-body mb-6 max-w-md mx-auto">
                {t("borrowerDashboard.noRequestsDesc")}
              </p>
              <Link href="/borrower/request/new" className="btn-amber">
                {t("borrowerDashboard.createFirst")}
              </Link>
            </div>
          </UCard>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            {requests.map((req) => {
              const convoCount =
                req._count?.conversations ?? req.conversations?.length ?? 0;
              const isDimmed = req.status === "EXPIRED" || req.status === "REJECTED";
              return (
                <Link
                  key={req.id}
                  href={`/borrower/request/${req.publicId}`}
                  className={`group block ${isDimmed ? "opacity-60" : ""}`}
                >
                  <UCard
                    pad={0}
                    className="transition-colors group-hover:border-forest-300"
                  >
                    <div className="p-6">
                      {/* Top row: type + status */}
                      <div className="flex items-center justify-between mb-3">
                        <UBadge
                          tone={req.mortgageCategory === "COMMERCIAL" ? "accent" : "info"}
                        >
                          {req.mortgageCategory === "COMMERCIAL"
                            ? t("request.commercial")
                            : t("request.residential")}
                        </UBadge>
                        <StatusBadge status={req.status} />
                      </div>

                      {/* Status notes */}
                      {req.status === "PENDING_APPROVAL" && (
                        <p className="font-body text-xs text-warning-700 mb-2">
                          {t("request.pendingApprovalNote", "Your request is under review.")}
                        </p>
                      )}
                      {req.status === "REJECTED" && (
                        <p className="font-body text-xs text-error-700 mb-2">
                          {t("request.rejectedNote", "This request was not approved.")}
                        </p>
                      )}

                      {/* Location */}
                      <h3 className="heading-sm mb-1 group-hover:text-forest-900 transition-colors">
                        {req.city ? `${req.city}, ` : ""}
                        {req.province || "--"}
                      </h3>

                      {/* Product type chips */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {(req.productTypes ?? []).map((pt) => (
                          <span
                            key={pt}
                            className="inline-flex items-center rounded-sm border border-cream-300 bg-cream-50 px-2 py-0.5 font-body text-[11px] font-medium text-forest-700"
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
                          <span className="font-mono text-[13px] text-amber-600">↗</span>
                          {convoCount}{" "}
                          {convoCount !== 1
                            ? t("borrowerDashboard.responsesPlural", "responses")
                            : t("borrowerDashboard.response", "response")}
                        </span>
                      </div>
                    </div>
                  </UCard>
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
