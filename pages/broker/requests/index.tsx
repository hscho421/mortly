import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import Layout from "@/components/Layout";
import { SkeletonRequestList } from "@/components/Skeleton";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import { PRODUCT_LABEL_KEYS, TIMELINE_LABEL_KEYS } from "@/lib/requestConfig";
import StatusBadge from "@/components/StatusBadge";

const PROVINCES = [
  "",
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Nova Scotia",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function BrokerRequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");

  interface BrokerRequest {
    id: string;
    publicId: string;
    province: string;
    city?: string | null;
    status: string;
    createdAt: string | Date;
    mortgageCategory?: string | null;
    productTypes?: string[] | null;
    desiredTimeline?: string | null;
    conversations?: { broker?: { userId: string } }[];
    _count?: { conversations?: number };
    /** True if this broker hasn't marked this request as seen yet. */
    isNew?: boolean;
  }

  const [requests, setRequests] = useState<BrokerRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [newCount, setNewCount] = useState(0);

  const [filterProvince, setFilterProvince] = useState("");
  const [filterMortgageCategory, setFilterMortgageCategory] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "BROKER") {
      router.push("/login", undefined, { locale: router.locale });
      return;
    }

    const fetchRequests = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (filterProvince) params.set("province", filterProvince);
        if (filterMortgageCategory) params.set("mortgageCategory", filterMortgageCategory);

        const res = await fetch(`/api/requests?${params.toString()}`);
        if (res.status === 403) {
          setError("NOT_VERIFIED");
          return;
        }
        if (!res.ok) throw new Error(t("broker.failedToFetchRequests"));
        const json = await res.json();
        setRequests(json.data ?? json);
        if (typeof json.newCount === "number") {
          setNewCount(json.newCount);
        }
      } catch {
        setError(t("broker.failedToLoadRequests"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
  }, [session, status, router, filterProvince, filterMortgageCategory]);

  // Mark requests as seen when the broker navigates away from this page.
  // The `newCount` badge stays visible during the visit; the backend timestamp
  // updates on unmount so the next visit reflects only genuinely new requests.
  useEffect(() => {
    if (!session || session.user.role !== "BROKER") return;
    return () => {
      fetch("/api/brokers/mark-requests-seen", { method: "POST" }).catch(
        () => {
          // Best-effort — stale count on next load isn't a hard failure
        },
      );
    };
  }, [session]);

  if (status === "loading") {
    return (
      <Layout>
        <Head><title>{t("titles.brokerBrowseRequests")}</title></Head>
        <SkeletonRequestList />
      </Layout>
    );
  }

  if (!session || session.user.role !== "BROKER") {
    return null;
  }

  // Show verification required message
  if (error === "NOT_VERIFIED") {
    return (
      <Layout>
        <Head><title>{t("titles.brokerBrowseRequests")}</title></Head>
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="card-elevated text-center py-16 animate-fade-in-up">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <h2 className="heading-md mb-2">{t("broker.verificationRequired", "Verification Required")}</h2>
            <p className="text-body mb-4 max-w-md mx-auto">
              {t("broker.verificationRequiredDesc", "Your broker profile must be verified before you can browse borrower requests. Please wait for admin approval.")}
            </p>
            <p className="text-body-sm text-sage-500 mb-2 max-w-md mx-auto">
              {t("broker.verificationTimeline")}
            </p>
            <p className="text-body-sm text-sage-500 mb-6 max-w-md mx-auto">
              {t("broker.contactSupport")} <a href="mailto:support@mortly.ca" className="text-forest-700 underline hover:text-forest-900">support@mortly.ca</a>
            </p>
            <Link href="/broker/dashboard" className="btn-primary">
              {t("nav.dashboard")}
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  // Filter out requests the broker has already responded to
  const brokerId = session.user.id;
  const filteredRequests = requests.filter(
    (req) => !req.conversations?.some((conv: { broker?: { userId: string } }) => conv.broker?.userId === brokerId)
  );

  return (
    <Layout>
      <Head><title>{t("titles.brokerBrowseRequests")}</title></Head>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="heading-lg">{t("broker.browseRequests")}</h1>
            {newCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 font-body text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-300/50">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                <span>{newCount}</span>
                <span>{t("browse.newSuffix", { defaultValue: "new" })}</span>
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 font-body text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                {t("browse.allCaughtUp", { defaultValue: "All caught up" })}
              </span>
            )}
          </div>
          <p className="text-body mt-2">
            {t("broker.requestsSubtitle")}
          </p>
        </div>

        {/* Filters */}
        <div className="card-elevated mb-8 animate-fade-in-up stagger-1">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="filterProvince" className="label-text">
                {t("request.province")}
              </label>
              <select
                id="filterProvince"
                value={filterProvince}
                onChange={(e) => setFilterProvince(e.target.value)}
                className="input-field"
              >
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p || t("broker.allProvinces")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filterMortgageCategory" className="label-text">
                {t("broker.categoryFilter")}
              </label>
              <select
                id="filterMortgageCategory"
                value={filterMortgageCategory}
                onChange={(e) => setFilterMortgageCategory(e.target.value)}
                className="input-field"
              >
                <option value="">{t("broker.allTypes")}</option>
                <option value="RESIDENTIAL">{t("request.residential")}</option>
                <option value="COMMERCIAL">{t("request.commercial")}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl bg-error-50 border border-error-500/20 p-4 animate-fade-in" role="alert">
            <p className="font-body text-sm text-error-700">{error}</p>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <p className="text-body-sm">{t("broker.loadingRequests")}</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredRequests.length === 0 && (
          <div className="card-elevated py-16 text-center animate-fade-in">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cream-200">
              <svg className="h-6 w-6 text-sage-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <p className="font-body text-sm font-medium text-forest-700">{t("broker.noMatchingRequests")}</p>
            <p className="text-body-sm mt-1">
              {t("broker.noMatchingRequestsDesc")}
            </p>
          </div>
        )}

        {/* Request cards */}
        {!isLoading && filteredRequests.length > 0 && (
          <div className="space-y-4">
            {filteredRequests.map((req, i) => {
              return (
                <div
                  key={req.id}
                  className={`card animate-fade-in-up stagger-${Math.min(i + 2, 6)} ${
                    req.isNew ? "ring-2 ring-amber-300/50 bg-amber-50/30" : ""
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        {req.isNew && (
                          <span
                            className="h-2 w-2 rounded-full bg-amber-400"
                            aria-label="New"
                          />
                        )}
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
                        <span className="font-body text-xs text-forest-700/50">
                          {t("broker.posted")} {formatDate(req.createdAt as unknown as string)}
                        </span>
                      </div>

                      <h3 className="heading-sm">
                        {`${req.mortgageCategory === "COMMERCIAL" ? t("request.commercial") : t("request.residential")} — ${req.city ? `${req.city}, ` : ""}${req.province}`}
                      </h3>

                      {/* Product pills */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(req.productTypes ?? []).map((pt) => (
                          <span
                            key={pt}
                            className="inline-flex items-center rounded-full bg-cream-200 px-2 py-0.5 font-body text-xs font-medium text-forest-700"
                          >
                            {t(PRODUCT_LABEL_KEYS[pt] ?? pt)}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                        {req.desiredTimeline && (
                          <div>
                            <span className="font-body text-xs font-medium text-forest-700/50">{t("request.desiredTimeline")}</span>
                            <p className="font-body text-sm text-forest-800">{t(TIMELINE_LABEL_KEYS[req.desiredTimeline!] || req.desiredTimeline!)}</p>
                          </div>
                        )}
                        <div>
                          <span className="font-body text-xs font-medium text-forest-700/50">{t("broker.responses")}</span>
                          <p className="font-body text-sm text-forest-800">{req._count?.conversations ?? 0}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <Link
                        href={`/broker/requests/${req.publicId}`}
                        className="btn-secondary text-center text-xs px-4 py-2"
                      >
                        {t("broker.viewDetails")}
                      </Link>
                      <Link
                        href={`/broker/requests/${req.publicId}`}
                        className="btn-primary text-center text-xs px-4 py-2"
                      >
                        {t("broker.respondToRequest")}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});
