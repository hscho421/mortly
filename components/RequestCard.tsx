import Link from "next/link";
import StatusBadge from "./StatusBadge";
import { isV2Request, PRODUCT_LABEL_KEYS, TIMELINE_LABEL_KEYS } from "@/lib/requestConfig";
import { useTranslation } from "next-i18next";

interface RequestCardProps {
  request: {
    id: string;
    publicId: string;
    requestType?: string | null;
    province: string;
    city?: string | null;
    propertyType?: string | null;
    priceRangeMin?: number | null;
    priceRangeMax?: number | null;
    mortgageAmountMin?: number | null;
    mortgageAmountMax?: number | null;
    closingTimeline?: string | null;
    status: string;
    createdAt: string | Date;
    mortgageCategory?: string | null;
    productTypes?: string[] | null;
    schemaVersion?: number | null;
    desiredTimeline?: string | null;
    _count: {
      introductions: number;
    };
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRange(
  min?: number | null,
  max?: number | null
): string | null {
  if (min != null && max != null) return `${formatCurrency(min)} - ${formatCurrency(max)}`;
  if (min != null) return `From ${formatCurrency(min)}`;
  if (max != null) return `Up to ${formatCurrency(max)}`;
  return null;
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const TYPE_ICONS: Record<string, string> = {
  PURCHASE: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6",
  REFINANCE: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  RENEWAL: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  RESIDENTIAL: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25",
  COMMERCIAL: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21",
};

export default function RequestCard({ request }: RequestCardProps) {
  const { t } = useTranslation("common");
  const v2 = isV2Request(request);

  if (v2) {
    const isCommercial = request.mortgageCategory === "COMMERCIAL";
    const iconPath = isCommercial ? TYPE_ICONS.COMMERCIAL : TYPE_ICONS.RESIDENTIAL;

    return (
      <div className="group card">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors ${
              isCommercial
                ? "bg-amber-50 text-amber-600 group-hover:bg-amber-100"
                : "bg-forest-50 text-forest-600 group-hover:bg-forest-100"
            }`}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg text-forest-800">
                  {isCommercial ? t("request.commercial") : t("request.residential")}
                </h3>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-body text-[10px] font-semibold ${
                  isCommercial
                    ? "bg-amber-100 text-amber-800"
                    : "bg-forest-100 text-forest-700"
                }`}>
                  {isCommercial ? t("request.commercial") : t("request.residential")}
                </span>
              </div>
              <p className="mt-0.5 font-body text-sm text-sage-500">
                {request.city ? `${request.city}, ` : ""}
                {request.province}
              </p>
            </div>
          </div>
          <StatusBadge status={request.status} />
        </div>

        {/* Product pills */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {(request.productTypes ?? []).map((pt) => (
            <span
              key={pt}
              className="inline-flex items-center rounded-full bg-cream-200 px-2.5 py-0.5 font-body text-xs font-medium text-forest-700"
            >
              {t(PRODUCT_LABEL_KEYS[pt] ?? pt)}
            </span>
          ))}
        </div>

        {/* Timeline if present */}
        {request.desiredTimeline && (
          <dl className="mt-4 grid grid-cols-1 gap-y-2">
            <div>
              <dt className="font-body text-xs font-medium uppercase tracking-wider text-sage-400">
                {t("request.desiredTimeline")}
              </dt>
              <dd className="mt-0.5 font-body text-sm font-medium text-forest-800">
                {t(TIMELINE_LABEL_KEYS[request.desiredTimeline] || request.desiredTimeline)}
              </dd>
            </div>
          </dl>
        )}

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-cream-200 pt-4">
          <div className="flex items-center gap-4 font-body text-xs text-sage-400">
            <span>{formatDate(request.createdAt)}</span>
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
              </svg>
              {request._count.introductions}{" "}
              {request._count.introductions === 1 ? "intro" : "intros"}
            </span>
          </div>
          <Link
            href={`/requests/${request.publicId}`}
            className="font-body text-sm font-semibold text-forest-700 transition-colors hover:text-amber-600"
          >
            View Details &rarr;
          </Link>
        </div>
      </div>
    );
  }

  // Legacy v1 rendering
  const priceRange = formatRange(request.priceRangeMin, request.priceRangeMax);
  const mortgageRange = formatRange(request.mortgageAmountMin, request.mortgageAmountMax);
  const iconPath = TYPE_ICONS[request.requestType || "PURCHASE"] || TYPE_ICONS.PURCHASE;

  return (
    <div className="group card">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-600 transition-colors group-hover:bg-forest-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
            </svg>
          </div>
          <div>
            <h3 className="font-display text-lg text-forest-800">
              {(request.requestType || "REQUEST").replace(/_/g, " ")}
            </h3>
            <p className="mt-0.5 font-body text-sm text-sage-500">
              {request.city ? `${request.city}, ` : ""}
              {request.province}
            </p>
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {/* Details grid */}
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <dt className="font-body text-xs font-medium uppercase tracking-wider text-sage-400">Property</dt>
          <dd className="mt-0.5 font-body text-sm font-medium text-forest-800">
            {(request.propertyType || "--").replace(/_/g, " ")}
          </dd>
        </div>

        {priceRange && (
          <div>
            <dt className="font-body text-xs font-medium uppercase tracking-wider text-sage-400">Price Range</dt>
            <dd className="mt-0.5 font-body text-sm font-medium text-forest-800">{priceRange}</dd>
          </div>
        )}

        {mortgageRange && (
          <div>
            <dt className="font-body text-xs font-medium uppercase tracking-wider text-sage-400">Mortgage</dt>
            <dd className="mt-0.5 font-body text-sm font-medium text-forest-800">{mortgageRange}</dd>
          </div>
        )}

        {request.closingTimeline && (
          <div>
            <dt className="font-body text-xs font-medium uppercase tracking-wider text-sage-400">Timeline</dt>
            <dd className="mt-0.5 font-body text-sm font-medium text-forest-800">
              {request.closingTimeline}
            </dd>
          </div>
        )}
      </dl>

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between border-t border-cream-200 pt-4">
        <div className="flex items-center gap-4 font-body text-xs text-sage-400">
          <span>{formatDate(request.createdAt)}</span>
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
            </svg>
            {request._count.introductions}{" "}
            {request._count.introductions === 1 ? "intro" : "intros"}
          </span>
        </div>
        <Link
          href={`/requests/${request.publicId}`}
          className="font-body text-sm font-semibold text-forest-700 transition-colors hover:text-amber-600"
        >
          View Details &rarr;
        </Link>
      </div>
    </div>
  );
}
