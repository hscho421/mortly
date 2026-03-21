import { useTranslation } from "next-i18next";
import { PRODUCT_LABEL_KEYS } from "@/lib/requestConfig";
import type { LiveRequest } from "@/types";

function timeAgo(dateStr: string, t: (key: string, opts?: Record<string, string>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return t("home.live.timeAgo", { time: `${Math.max(1, mins)}m` });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("home.live.timeAgo", { time: `${hours}h` });
  const days = Math.floor(hours / 24);
  return t("home.live.timeAgo", { time: `${days}d` });
}

export default function LiveActivityCard({ request }: { request: LiveRequest }) {
  const { t } = useTranslation("common");
  const isCommercial = request.mortgageCategory === "COMMERCIAL";
  const isOpen = request.status === "OPEN";

  return (
    <div className="flex-shrink-0 w-64 rounded-2xl border border-cream-300 bg-white/80 p-4 shadow-sm transition-transform hover:scale-[1.02]">
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
            className="inline-flex items-center rounded-full bg-cream-200 px-2 py-0.5 font-body text-[10px] font-medium text-forest-700"
          >
            {t(PRODUCT_LABEL_KEYS[pt] ?? pt)}
          </span>
        ))}
      </div>

      {/* Location */}
      <p className="font-body text-xs text-sage-500 mb-3">
        {request.city ? `${request.city}, ` : ""}
        {request.province}
      </p>

      {/* Status + time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isOpen ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`}
          />
          <span className="font-body text-[10px] font-medium text-forest-700/70">
            {isOpen ? t("home.live.seekingBroker") : t("home.live.brokerMatched")}
          </span>
        </div>
        <span className="font-body text-[10px] text-sage-400">
          {timeAgo(request.createdAt, t)}
        </span>
      </div>
    </div>
  );
}
