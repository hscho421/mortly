import Link from "next/link";
import { useTranslation } from "next-i18next";
import { Badge, Eyebrow } from "@/components/broker/ui";
import {
  ResidentialBlocks,
  CommercialBlocks,
  NotesBlock,
  timelineLabel,
} from "@/components/broker/RequestDetailBlocks";
import { PRODUCT_LABEL_KEYS } from "@/lib/requestConfig";
import type { ResidentialDetails, CommercialDetails } from "@/types";

/**
 * Right-hand context panel for /broker/messages.
 *
 * Given the "request" object attached to an active conversation, renders the
 * complete borrower submission so the broker can see income, property
 * details, timeline, and notes without leaving the thread. The rendering
 * primitives are shared with /broker/requests/[id] via RequestDetailBlocks
 * so the two surfaces stay in lockstep.
 *
 * The conversation detail API (/api/conversations/[id]) already authorizes
 * the viewer as a participant before returning this data, so no additional
 * gating is needed in the presentation layer.
 */
export interface RequestContextData {
  id: string;
  publicId?: string | null;
  province?: string | null;
  city?: string | null;
  status?: string | null;
  mortgageCategory?: string | null;
  productTypes?: string[] | null;
  desiredTimeline?: string | null;
  details?: ResidentialDetails | CommercialDetails | null;
  notes?: string | null;
  createdAt?: string | null;
}

export default function RequestContextPanel({
  request,
  onClose,
  viewFullHrefPrefix = "/broker/requests",
}: {
  request: RequestContextData | null | undefined;
  /** When set, renders an X button (for tablet/mobile sheet use). */
  onClose?: () => void;
  /**
   * URL prefix for the "view full request" deep link. Defaults to the broker
   * route; the borrower side passes "/borrower/request" so the same panel
   * works for both audiences.
   */
  viewFullHrefPrefix?: string;
}) {
  const { t } = useTranslation("common");

  if (!request) {
    return (
      <aside
        className="flex h-full w-full flex-col border-l border-cream-300 bg-cream-50"
        aria-label={t("broker.requestContext", "Request context")}
      >
        <PanelHeader onClose={onClose} t={t} />
        <div className="flex flex-1 items-center justify-center px-5 text-center font-body text-[13px] text-sage-500">
          {t(
            "broker.noRequestContext",
            "Select a conversation to see the request behind it.",
          )}
        </div>
      </aside>
    );
  }

  const category =
    request.mortgageCategory === "COMMERCIAL"
      ? t("request.commercial")
      : t("request.residential");
  const region = request.city
    ? `${request.city}, ${request.province ?? ""}`
    : (request.province ?? "");
  const firstProduct = (request.productTypes ?? [])[0];
  const timeline = timelineLabel(request.desiredTimeline ?? null, t);

  return (
    <aside
      className="flex h-full w-full flex-col border-l border-cream-300 bg-cream-50"
      aria-label={t("broker.requestContext", "Request context")}
    >
      <PanelHeader onClose={onClose} t={t} />

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            tone={request.mortgageCategory === "COMMERCIAL" ? "accent" : "neutral"}
          >
            {category}
          </Badge>
          {request.status && (
            <Badge tone={request.status === "OPEN" ? "success" : "neutral"}>
              {t(`statusLabel.${request.status}`, request.status)}
            </Badge>
          )}
          {request.publicId && (
            <span className="ml-auto font-mono text-[11px] text-sage-500">
              #{request.publicId}
            </span>
          )}
        </div>

        {/* Title */}
        <div>
          <div className="font-display text-lg font-semibold leading-snug text-forest-800">
            {category}
            {firstProduct && (
              <>
                <span className="text-sage-400"> · </span>
                {t(PRODUCT_LABEL_KEYS[firstProduct] ?? firstProduct)}
              </>
            )}
          </div>
          <div className="mt-1 font-body text-[13px] text-forest-700/80">
            {region || t("request.notSpecified")}
          </div>
        </div>

        {/* All product pills — helpful when the borrower picked multiple. */}
        {request.productTypes && request.productTypes.length > 1 && (
          <div>
            <Eyebrow>{t("request.selectProducts")}</Eyebrow>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {request.productTypes.map((pt) => (
                <span
                  key={pt}
                  className="inline-flex items-center rounded-sm border border-cream-300 bg-cream-100 px-1.5 py-0.5 font-body text-[11px] text-forest-700"
                >
                  {t(PRODUCT_LABEL_KEYS[pt] ?? pt)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Timeline — rendered when set */}
        {timeline && (
          <div className="rounded-sm border border-cream-300 bg-cream-100 p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-sage-500">
              {t("request.desiredTimeline")}
            </div>
            <div className="mt-1 font-body text-sm font-medium text-forest-800">
              {timeline}
            </div>
          </div>
        )}

        {/* Full income/type/financials rendering — single-column grid so blocks stack inside the narrow panel. */}
        {request.details && (
          <div>
            <Eyebrow>{t("broker.detailsEyebrow", "상세 정보")}</Eyebrow>
            <div className="mt-2 grid grid-cols-1 gap-3">
              {request.mortgageCategory === "COMMERCIAL" ? (
                <CommercialBlocks
                  details={request.details as CommercialDetails}
                  t={t}
                />
              ) : (
                <ResidentialBlocks
                  details={request.details as ResidentialDetails}
                  t={t}
                />
              )}
            </div>
          </div>
        )}

        {/* Notes — compact scrollable */}
        {request.notes && <NotesBlock notes={request.notes} compact />}
      </div>

      <div className="border-t border-cream-300 px-5 py-4">
        {request.publicId ? (
          <Link
            href={`${viewFullHrefPrefix}/${request.publicId}`}
            className="inline-flex w-full items-center justify-center gap-1 rounded-sm border border-cream-300 bg-cream-50 px-4 py-2.5 font-body text-[13px] font-semibold text-forest-800 transition-colors hover:bg-cream-200"
          >
            {t("broker.viewFullRequest", "전체 요청 보기")} →
          </Link>
        ) : (
          <p className="text-center font-body text-[12px] text-sage-500">
            {t(
              "broker.noFullRequestLink",
              "Full request data unavailable for this conversation.",
            )}
          </p>
        )}
      </div>
    </aside>
  );
}

function PanelHeader({
  onClose,
  t,
}: {
  onClose?: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  return (
    <div className="flex items-center justify-between border-b border-cream-300 px-5 py-4">
      <Eyebrow>{t("broker.requestContext", "Request context")}</Eyebrow>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close", "Close")}
          className="rounded-sm p-1.5 text-sage-500 transition-colors hover:bg-cream-200 hover:text-forest-800"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
