import { useTranslation } from "next-i18next";
import { PRODUCT_LABEL_KEYS } from "@/lib/requestConfig";
import type { LiveRequest } from "@/types";

export default function LiveActivityCard({ request }: { request: LiveRequest }) {
  const { t } = useTranslation("common");
  const isCommercial = request.mortgageCategory === "COMMERCIAL";

  const statusLabel =
    request.status === "OPEN"
      ? t("home.live.seekingBroker")
      : request.status === "IN_PROGRESS"
        ? t("home.live.inProgress")
        : t("home.live.completed");

  const statusTone =
    request.status === "IN_PROGRESS"
      ? { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" }
      : request.status === "OPEN"
        ? { dot: "bg-forest-600", text: "text-forest-700", bg: "bg-cream-100", border: "border-cream-300" }
        : { dot: "bg-sage-400", text: "text-sage-600", bg: "bg-cream-100", border: "border-cream-300" };

  return (
    <div className="flex-shrink-0 w-72 rounded-sm border border-cream-300 bg-cream-50 p-5 transition-colors hover:border-amber-400">
      {/* Status row — mono eyebrow with live dot */}
      <div className="flex items-center justify-between mb-4">
        <div className={`inline-flex items-center gap-1.5 rounded-sm border ${statusTone.border} ${statusTone.bg} px-2 py-0.5`}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusTone.dot} ${request.status !== "CLOSED" ? "animate-pulse" : ""}`} />
          <span className={`font-mono text-[10px] uppercase tracking-[0.12em] font-semibold ${statusTone.text}`}>
            {statusLabel}
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-sage-500">
          {isCommercial ? t("request.commercial") : t("request.residential")}
        </span>
      </div>

      {/* Product types — serif display, stacked */}
      <div className="mb-4">
        {request.productTypes.map((pt, i) => (
          <div
            key={pt}
            className="font-display font-semibold text-forest-800 text-lg leading-snug tracking-tight"
          >
            {i === 0 ? (
              <>{t(PRODUCT_LABEL_KEYS[pt] ?? pt)}</>
            ) : (
              <span className="text-forest-800/70">{t(PRODUCT_LABEL_KEYS[pt] ?? pt)}</span>
            )}
          </div>
        ))}
      </div>

      {/* Location — mono */}
      <div className="pt-3 border-t border-cream-300">
        <div className="flex items-center gap-1.5">
          <svg className="h-3 w-3 text-sage-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          <span className="font-mono text-[11px] tracking-[0.05em] text-sage-600">
            {request.city ? `${request.city}, ` : ""}
            {request.province}
          </span>
        </div>
      </div>
    </div>
  );
}
