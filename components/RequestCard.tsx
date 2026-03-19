import React from "react";
import Link from "next/link";
import StatusBadge from "./StatusBadge";

interface RequestCardProps {
  request: {
    id: string;
    requestType: string;
    province: string;
    city?: string | null;
    propertyType: string;
    priceRangeMin?: number | null;
    priceRangeMax?: number | null;
    mortgageAmountMin?: number | null;
    mortgageAmountMax?: number | null;
    closingTimeline?: string | null;
    status: string;
    createdAt: string | Date;
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
};

export default function RequestCard({ request }: RequestCardProps) {
  const priceRange = formatRange(request.priceRangeMin, request.priceRangeMax);
  const mortgageRange = formatRange(request.mortgageAmountMin, request.mortgageAmountMax);
  const iconPath = TYPE_ICONS[request.requestType] || TYPE_ICONS.PURCHASE;

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
              {request.requestType.replace(/_/g, " ")}
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
            {request.propertyType.replace(/_/g, " ")}
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
          href={`/requests/${request.id}`}
          className="font-body text-sm font-semibold text-forest-700 transition-colors hover:text-amber-600"
        >
          View Details &rarr;
        </Link>
      </div>
    </div>
  );
}
