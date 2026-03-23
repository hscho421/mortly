import { useTranslation } from "next-i18next";
import { PRODUCT_LABEL_KEYS } from "@/lib/requestConfig";
import type { LiveRequest } from "@/types";

export default function LiveActivityCard({ request }: { request: LiveRequest }) {
  const { t } = useTranslation("common");
  const isCommercial = request.mortgageCategory === "COMMERCIAL";

  return (
    <div className="flex-shrink-0 w-72 rounded-2xl border border-cream-300 bg-white p-5 shadow-md transition-transform hover:scale-[1.03]">
      {/* Header: icon + category */}
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            isCommercial
              ? "bg-amber-50 text-amber-600"
              : "bg-forest-50 text-forest-600"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            {isCommercial ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            )}
          </svg>
        </div>
        <span
          className={`font-body text-xs font-semibold ${
            isCommercial ? "text-amber-700" : "text-forest-700"
          }`}
        >
          {isCommercial ? t("request.commercial") : t("request.residential")}
        </span>
      </div>

      {/* Product pills */}
      <div className="flex flex-wrap gap-1 mb-3">
        {request.productTypes.map((pt) => (
          <span
            key={pt}
            className="inline-flex items-center rounded-full bg-cream-200 px-2.5 py-1 font-body text-xs font-medium text-forest-700"
          >
            {t(PRODUCT_LABEL_KEYS[pt] ?? pt)}
          </span>
        ))}
      </div>

      {/* Location */}
      <p className="font-body text-sm text-sage-600 mb-3">
        {request.city ? `${request.city}, ` : ""}
        {request.province}
      </p>

      {/* Status */}
      <div className="flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full ${
            request.status === "OPEN"
              ? "bg-emerald-500 animate-pulse"
              : request.status === "IN_PROGRESS"
                ? "bg-amber-500 animate-pulse"
                : "bg-sage-400"
          }`}
        />
        <span className="font-body text-xs font-medium text-forest-700">
          {request.status === "OPEN"
            ? t("home.live.seekingBroker")
            : request.status === "IN_PROGRESS"
              ? t("home.live.inProgress")
              : t("home.live.completed")}
        </span>
      </div>
    </div>
  );
}
