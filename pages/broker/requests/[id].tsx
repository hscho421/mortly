import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import BrokerShell from "@/components/broker/BrokerShell";
import { useBrokerData } from "@/components/broker/BrokerDataContext";
import {
  AppTopbar,
  Badge,
  Btn,
  Card,
  Eyebrow,
} from "@/components/broker/ui";
import { SkeletonRequestDetail } from "@/components/Skeleton";
import ReportButton from "@/components/ReportButton";
import {
  ResidentialBlocks,
  CommercialBlocks,
} from "@/components/broker/RequestDetailBlocks";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import nextI18NextConfig from "@/next-i18next.config.js";
import type { GetStaticProps, GetStaticPaths } from "next";
import {
  PRODUCT_LABEL_KEYS,
  TIMELINE_LABEL_KEYS,
} from "@/lib/requestConfig";
import { dateLocale } from "@/lib/format";

function formatDate(dateStr: string, locale?: string): string {
  return new Date(dateStr).toLocaleDateString(dateLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function relativeTime(dateStr: string, locale: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const m = Math.max(0, Math.floor((now - then) / 60_000));
  if (m < 1) return locale === "ko" ? "방금" : "just now";
  if (m < 60) return locale === "ko" ? `${m}분 전` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return locale === "ko" ? `${h}시간 전` : `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return locale === "ko" ? `${d}일 전` : `${d}d ago`;
  return formatDate(dateStr, locale);
}

// Conversation-create error codes that mean "needs billing", not a hard error —
// rendered as a warm upgrade card with a link to /broker/billing.
const UPGRADE_CODES = ["UPGRADE_REQUIRED", "NO_CREDITS", "SUBSCRIPTION_PAST_DUE"];

export default function BrokerRequestDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const { t } = useTranslation("common");
  const { profile, refresh: refreshBrokerData } = useBrokerData();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [request, setRequest] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(""); // fatal load error → "not found" view
  // Action error from "start conversation" — kept SEPARATE from `error` so a
  // gate (free plan / no credits / past due) doesn't nuke the page to "request
  // not found". Carries the API's machine-readable code for localized copy.
  const [actionError, setActionError] = useState<{ code?: string; message: string } | null>(null);
  const [isStartingChat, setIsStartingChat] = useState(false);
  // Non-PREMIUM brokers must confirm before a single click spends a credit.
  const [confirmingRespond, setConfirmingRespond] = useState(false);

  useEffect(() => {
    if (status === "loading" || !id) return;
    if (!session || session.user.role !== "BROKER") return;

    const fetchRequest = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/requests/${id}`);
        if (!res.ok) throw new Error(t("common.failedToLoad"));
        const data = await res.json();
        setRequest(data);
      } catch {
        setError(t("common.failedToLoad"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequest();

    // Mark this single request as seen so the gold "new" dot clears from the
    // browse list. Fire-and-forget — UI doesn't depend on the response.
    fetch(`/api/brokers/requests/${encodeURIComponent(id as string)}/mark-seen`, {
      method: "POST",
    }).catch(() => {
      // best-effort
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, id]);

  async function handleStartConversation() {
    if (!request || isStartingChat) return;
    setIsStartingChat(true);
    setActionError(null);

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.publicId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError({ code: data.code, message: data.error || t("common.somethingWentWrong") });
        setIsStartingChat(false);
        return;
      }

      const conversation = await res.json();
      // Refresh shell context so the topbar credit chip and sidebar
      // counters reflect the post-deduction state without waiting for the
      // 30s poll. Fire-and-forget; the navigation below doesn't depend on
      // it resolving.
      refreshBrokerData().catch(() => {
        // best-effort
      });
      router.push(`/broker/messages?id=${conversation.id}`, undefined, {
        locale: router.locale,
      });
    } catch {
      setActionError({ message: t("common.unexpectedError") });
      setIsStartingChat(false);
    }
  }

  if (status === "loading" || isLoading) {
    return (
      <BrokerShell active="requests" pageTitle={t("titles.brokerRequestDetail")}>
        <Head>
          <title>{t("titles.brokerRequestDetail")}</title>
        </Head>
        <SkeletonRequestDetail />
      </BrokerShell>
    );
  }

  if (error || !request) {
    return (
      <BrokerShell active="requests" pageTitle={t("titles.brokerRequestDetail")}>
        <Head>
          <title>{t("titles.brokerRequestDetail")}</title>
        </Head>
        <AppTopbar
          eyebrow={t("broker.requestsEyebrow", "상담 요청")}
          title={t("misc.requestNotFound")}
          actions={
            <Btn as="a" href="/broker/requests" variant="ghost" size="sm">
              ← {t("broker.backToRequests")}
            </Btn>
          }
        />
        <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
          <Card padding="lg">
            <p role="alert" className="font-body text-sm text-error-700">
              {error || t("misc.requestNotFound")}
            </p>
          </Card>
        </div>
      </BrokerShell>
    );
  }

  const locale = router.locale === "ko" ? "ko" : "en";
  const brokerTier = profile?.subscriptionTier ?? "BASIC";
  const brokerCredits = profile?.responseCredits ?? 0;
  const brokerProfileId = profile?.id ?? "";
  const unlimited = brokerTier === "PREMIUM";

  const hasResponded = (request.conversations ?? []).some(
    (conv: { brokerId: string }) => conv.brokerId === brokerProfileId,
  );

  const categoryLabel =
    request.mortgageCategory === "COMMERCIAL"
      ? t("request.commercial")
      : t("request.residential");
  const region = request.city
    ? `${request.city}, ${request.province}`
    : request.province;
  const firstProduct = (request.productTypes ?? [])[0];
  const responses = request._count?.conversations ?? 0;

  return (
    <BrokerShell active="requests" pageTitle={t("titles.brokerRequestDetail")}>
      <Head>
        <title>{t("titles.brokerRequestDetail")}</title>
      </Head>

      <AppTopbar
        eyebrow={
          <>
            <span className="font-mono">#{request.publicId}</span>
            <span> · </span>
            {relativeTime(request.createdAt as string, locale)}
          </>
        }
        title={
          <>
            {categoryLabel}{" "}
            <span className="text-sage-400">·</span>{" "}
            <span className="italic text-amber-600">{region}</span>
          </>
        }
        actions={
          <>
            <Btn as="a" href="/broker/requests" variant="ghost" size="sm">
              ← {t("broker.backToRequests")}
            </Btn>
            <ReportButton targetType="REQUEST" targetId={request.publicId} />
          </>
        }
      />

      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
        {/* Overview card — editorial header echoing the reference's tile. */}
        <Card padding="lg" className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={
                request.mortgageCategory === "COMMERCIAL"
                  ? "accent"
                  : "neutral"
              }
            >
              {categoryLabel}
              {firstProduct
                ? ` · ${t(PRODUCT_LABEL_KEYS[firstProduct] ?? firstProduct)}`
                : ""}
            </Badge>
            <Badge tone={request.status === "OPEN" ? "success" : "neutral"}>
              {t(`statusLabel.${request.status}`, request.status as string)}
            </Badge>
            <span className="ml-auto font-mono text-[11px] text-sage-500">
              {t("misc.brokerResponses", {
                count: responses,
              })}
            </span>
          </div>

          {/* Product pills */}
          {(request.productTypes ?? []).length > 1 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(request.productTypes ?? []).map((pt: string) => (
                <span
                  key={pt}
                  className="inline-flex items-center rounded-sm border border-cream-300 bg-cream-100 px-2.5 py-1 font-body text-[12px] text-forest-700"
                >
                  {t(PRODUCT_LABEL_KEYS[pt] ?? pt)}
                </span>
              ))}
            </div>
          )}

          {/* Key fact strip */}
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-cream-300 pt-4 sm:grid-cols-4">
            <FactCell
              label={t("request.province")}
              value={request.province}
            />
            {request.city && (
              <FactCell
                label={t("request.city", "도시")}
                value={request.city}
              />
            )}
            {request.desiredTimeline && (
              <FactCell
                label={t("request.desiredTimeline")}
                value={t(
                  TIMELINE_LABEL_KEYS[request.desiredTimeline] ??
                    request.desiredTimeline,
                )}
              />
            )}
            <FactCell
              label={t("broker.posted")}
              value={formatDate(request.createdAt as string, router.locale)}
            />
          </div>

          {/* Client notes */}
          {request.notes && (
            <div className="mt-5 rounded-sm border border-cream-300 bg-cream-100 p-4">
              <Eyebrow>{t("request.additionalNotes")}</Eyebrow>
              <p className="mt-2 whitespace-pre-wrap font-body text-[14px] leading-relaxed text-forest-800">
                {request.notes}
              </p>
            </div>
          )}
        </Card>

        {/* Category-specific details */}
        <Card padding="lg" className="mb-6">
          <Eyebrow>{t("broker.detailsEyebrow", "상세 정보")}</Eyebrow>
          <h2 className="mt-1 font-display text-xl font-semibold text-forest-800">
            {t("broker.requestDetailsTitle", "Request details")}
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {request.mortgageCategory === "COMMERCIAL" ? (
              <CommercialBlocks details={request.details} t={t} />
            ) : (
              <ResidentialBlocks details={request.details} t={t} />
            )}
          </div>
        </Card>

        {/* CTA card */}
        {hasResponded ? (
          <Card padding="lg" className="flex items-center justify-between gap-3 border-success-100 bg-success-50">
            <div className="flex items-center gap-3">
              <svg
                className="h-5 w-5 text-success-700"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="font-body text-sm font-medium text-success-700">
                {t("broker.alreadyMessaged")}
              </p>
            </div>
            <Btn as="a" href="/broker/messages" size="sm" variant="ghost">
              {t("broker.goToMessages")}
            </Btn>
          </Card>
        ) : (brokerTier === "BASIC" || brokerTier === "PRO") &&
          brokerCredits === 0 ? (
          <Card padding="lg" className="border-warning-100 bg-warning-50">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-warning-100">
                  <svg
                    className="h-4 w-4 text-warning-700"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                    />
                  </svg>
                </div>
                <p className="font-body text-sm font-medium text-forest-800">
                  {t("credits.noCreditsMessage")}
                </p>
              </div>
              <Btn as="a" href="/broker/billing" size="sm">
                {t("credits.upgradePlan")}
              </Btn>
            </div>
          </Card>
        ) : (
          <Card padding="lg">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Eyebrow>{t("broker.respondEyebrow", "응답하기")}</Eyebrow>
                <h3 className="mt-1 font-display text-lg font-semibold text-forest-800">
                  {t(
                    "broker.startDirectThread",
                    "Start a direct conversation",
                  )}
                </h3>
                <p className="mt-1 font-body text-[13px] text-sage-500">
                  {unlimited
                    ? t(
                        "broker.unlimitedPlanRespond",
                        "PREMIUM plan · unlimited responses.",
                      )
                    : t(
                        "broker.creditWillBeDeducted",
                        "1 credit will be used. {{remaining}} remaining.",
                        { remaining: brokerCredits },
                      )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!unlimited && confirmingRespond ? (
                  // Inline confirm — the "1 credit will be used. N remaining."
                  // hint above states the cost, so a single accidental click can
                  // no longer spend a credit (which is real money for BASIC/PRO).
                  <>
                    <Btn
                      variant="ghost"
                      size="md"
                      onClick={() => setConfirmingRespond(false)}
                      disabled={isStartingChat}
                    >
                      {t("broker.cancel", "취소")}
                    </Btn>
                    <Btn
                      onClick={handleStartConversation}
                      disabled={isStartingChat}
                      size="md"
                    >
                      {isStartingChat
                        ? t("broker.startingChat")
                        : t("broker.confirmRespond", "Use 1 credit")}{" "}
                      →
                    </Btn>
                  </>
                ) : (
                  <>
                    <Btn as="a" href="/broker/requests" variant="ghost" size="md">
                      {t("broker.backToList", "목록으로")}
                    </Btn>
                    <Btn
                      onClick={() =>
                        unlimited
                          ? handleStartConversation()
                          : setConfirmingRespond(true)
                      }
                      disabled={isStartingChat}
                      size="md"
                    >
                      {isStartingChat
                        ? t("broker.startingChat")
                        : t("broker.respond", "상담 시작")}{" "}
                      →
                    </Btn>
                  </>
                )}
              </div>
            </div>
            {actionError &&
              (UPGRADE_CODES.includes(actionError.code ?? "") ? (
                // A plan/credit gate — not a hard error. Explain it warmly and
                // route them to billing instead of a bare red alert.
                <div className="mt-4 rounded-sm border border-amber-200 bg-amber-50 p-5">
                  <div className="font-display text-[15px] font-semibold text-forest-800">
                    {t("broker.cannotMessageTitle", "아직 메시지를 보낼 수 없어요")}
                  </div>
                  <p className="mt-1.5 max-w-xl font-body text-[13px] leading-relaxed text-forest-700/80">
                    {actionError.code === "NO_CREDITS"
                      ? t(
                          "broker.noCreditsSubtitle",
                          "Upgrade your plan or buy more credits to continue responding to requests.",
                        )
                      : actionError.code === "SUBSCRIPTION_PAST_DUE"
                        ? t(
                            "broker.pastDueDesc",
                            "Your subscription payment is past due. Update your billing details to start messaging clients again.",
                          )
                        : t(
                            "broker.upgradeFreeDesc",
                            "The Free plan lets you browse requests, but messaging clients needs a paid plan. Upgrade to respond to requests and start conversations with borrowers.",
                          )}
                  </p>
                  <Btn as="a" href="/broker/billing" size="sm" className="mt-4">
                    {t("broker.viewBilling", "요금제·결제 보기")} →
                  </Btn>
                </div>
              ) : (
                <p
                  role="alert"
                  className="mt-3 rounded-sm border border-error-100 bg-error-50 px-3 py-2 font-body text-[13px] text-error-700"
                >
                  {actionError.message}
                </p>
              ))}
          </Card>
        )}
      </div>
    </BrokerShell>
  );
}

// ──────────────────────────────────────────────────────────────
// FactCell · small labeled value block used in the overview grid.
// ──────────────────────────────────────────────────────────────
function FactCell({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-sage-500">
        {label}
      </div>
      <div className="mt-1 font-body text-[13px] font-semibold text-forest-800">
        {value}
      </div>
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [],
  fallback: "blocking",
});

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"], nextI18NextConfig)),
  },
});
