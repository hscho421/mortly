import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "@/components/Layout";
import type { RequestWithIntroductions } from "@/types";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";

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

const REQUEST_TYPES = ["", "PURCHASE", "REFINANCE", "RENEWAL"];
const PROPERTY_TYPES = ["", "CONDO", "TOWNHOUSE", "DETACHED", "OTHER"];

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
}

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

  const [requests, setRequests] = useState<RequestWithIntroductions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [filterProvince, setFilterProvince] = useState("");
  const [filterRequestType, setFilterRequestType] = useState("");
  const [filterPropertyType, setFilterPropertyType] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "BROKER") {
      router.push("/login");
      return;
    }

    const fetchRequests = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (filterProvince) params.set("province", filterProvince);
        if (filterRequestType) params.set("requestType", filterRequestType);
        if (filterPropertyType) params.set("propertyType", filterPropertyType);

        const res = await fetch(`/api/requests?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch requests");
        const data = await res.json();
        setRequests(data);
      } catch {
        setError("Failed to load requests. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
  }, [session, status, router, filterProvince, filterRequestType, filterPropertyType]);

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

  // Filter out requests the broker has already responded to
  const brokerId = session.user.id;
  const filteredRequests = requests.filter(
    (req) => !req.introductions?.some((intro) => intro.broker?.userId === brokerId)
  );

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="heading-lg">{t("broker.browseRequests")}</h1>
          <p className="text-body mt-2">
            {t("broker.requestsSubtitle")}
          </p>
        </div>

        {/* Filters */}
        <div className="card-elevated mb-8 animate-fade-in-up stagger-1">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
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
              <label htmlFor="filterRequestType" className="label-text">
                {t("request.requestType")}
              </label>
              <select
                id="filterRequestType"
                value={filterRequestType}
                onChange={(e) => setFilterRequestType(e.target.value)}
                className="input-field"
              >
                {REQUEST_TYPES.map((rt) => (
                  <option key={rt} value={rt}>
                    {rt || t("broker.allTypes")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filterPropertyType" className="label-text">
                {t("request.propertyType")}
              </label>
              <select
                id="filterPropertyType"
                value={filterPropertyType}
                onChange={(e) => setFilterPropertyType(e.target.value)}
                className="input-field"
              >
                {PROPERTY_TYPES.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt || t("broker.allPropertyTypes")}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 animate-fade-in">
            <p className="font-body text-sm text-red-700">{error}</p>
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
            {filteredRequests.map((req, i) => (
              <div
                key={req.id}
                className={`card animate-fade-in-up stagger-${Math.min(i + 2, 6)}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-forest-100 px-2.5 py-0.5 font-body text-xs font-semibold text-forest-700">
                        {req.requestType}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-sage-100 px-2.5 py-0.5 font-body text-xs font-semibold text-sage-700">
                        {req.propertyType}
                      </span>
                      <span className="font-body text-xs text-forest-700/50">
                        {t("broker.posted")} {formatDate(req.createdAt as unknown as string)}
                      </span>
                    </div>
                    <h3 className="heading-sm">
                      {req.requestType} in {req.city ? `${req.city}, ` : ""}
                      {req.province}
                    </h3>
                    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                      <div>
                        <span className="font-body text-xs font-medium text-forest-700/50">{t("request.priceRange")}</span>
                        <p className="font-body text-sm text-forest-800">
                          {formatCurrency(req.priceRangeMin)} - {formatCurrency(req.priceRangeMax)}
                        </p>
                      </div>
                      <div>
                        <span className="font-body text-xs font-medium text-forest-700/50">{t("request.mortgageAmount")}</span>
                        <p className="font-body text-sm text-forest-800">
                          {formatCurrency(req.mortgageAmountMin)} - {formatCurrency(req.mortgageAmountMax)}
                        </p>
                      </div>
                      <div>
                        <span className="font-body text-xs font-medium text-forest-700/50">{t("request.closingTimeline")}</span>
                        <p className="font-body text-sm text-forest-800">
                          {req.closingTimeline || t("request.notSpecified")}
                        </p>
                      </div>
                      <div>
                        <span className="font-body text-xs font-medium text-forest-700/50">{t("broker.responses")}</span>
                        <p className="font-body text-sm text-forest-800">
                          {req._count?.introductions ?? 0}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <Link
                      href={`/broker/requests/${req.id}`}
                      className="btn-secondary text-center text-xs px-4 py-2"
                    >
                      {t("broker.viewDetails")}
                    </Link>
                    <Link
                      href={`/broker/introduction/new?requestId=${req.id}`}
                      className="btn-primary text-center text-xs px-4 py-2"
                    >
                      {t("broker.respondToRequest")}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});
