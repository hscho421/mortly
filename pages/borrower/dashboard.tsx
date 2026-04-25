import { useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import BorrowerShell from "@/components/borrower/BorrowerShell";
import {
  useBorrowerData,
  type BorrowerCachedRequest,
} from "@/components/borrower/BorrowerDataContext";
import {
  AppTopbar,
  Badge,
  Btn,
  Card,
  EmptyState,
  Eyebrow,
  SectionHead,
  StatCard,
} from "@/components/broker/ui";
import { SkeletonDashboard } from "@/components/Skeleton";
import StatusBadge from "@/components/StatusBadge";
import {
  PRODUCT_LABEL_KEYS,
  TIMELINE_LABEL_KEYS,
  getRequestTitle,
} from "@/lib/requestConfig";

// Re-export the cached request type under the page-local name so the helper
// components below can keep using it without churn. Conversation type is
// imported directly via context where needed.
type DashboardRequest = BorrowerCachedRequest;

function relativeTime(date: string, locale: string) {
  const now = Date.now();
  const then = new Date(date).getTime();
  const m = Math.max(0, Math.floor((now - then) / 60_000));
  if (m < 1) return locale === "ko" ? "방금" : "just now";
  if (m < 60) return locale === "ko" ? `${m}분 전` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return locale === "ko" ? `${h}시간 전` : `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return locale === "ko" ? `${d}일 전` : `${d}d ago`;
  return new Date(date).toLocaleDateString(
    locale === "ko" ? "ko-KR" : "en-CA",
    { month: "short", day: "numeric" },
  );
}

function firstName(fullName: string | null | undefined, fallback: string) {
  if (!fullName) return fallback;
  return fullName.split(" ")[0] || fallback;
}

export default function BorrowerDashboard() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const {
    profile,
    requests,
    conversations,
    loaded: contextLoaded,
  } = useBorrowerData();

  // Page reads requests + conversations directly from BorrowerDataContext —
  // no separate fetch — so the dashboard inherits whatever the context's
  // 30s poll has cached. Mutation flows (request create / edit / delete)
  // call `refresh()` on the context before navigating here.
  const loading = !contextLoaded;
  const error: string | null = null;

  const locale = router.locale === "ko" ? "ko" : "en";

  const activeRequest = useMemo(
    () =>
      requests.find(
        (r) => r.status === "OPEN" || r.status === "IN_PROGRESS",
      ) ?? null,
    [requests],
  );

  const totalResponses = useMemo(
    () =>
      requests.reduce(
        (sum, r) =>
          sum + (r._count?.conversations ?? r.conversations?.length ?? 0),
        0,
      ),
    [requests],
  );

  const activeCount = useMemo(
    () =>
      requests.filter(
        (r) => r.status === "OPEN" || r.status === "IN_PROGRESS",
      ).length,
    [requests],
  );

  // Activity feed = conversations sorted by updatedAt, top 5.
  const recentActivity = useMemo(
    () =>
      [...conversations]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        .slice(0, 5),
    [conversations],
  );

  // Pending or rejected request → priority banner.
  const rejectedReq = requests.find((r) => r.status === "REJECTED");
  const pendingReq = requests.find((r) => r.status === "PENDING_APPROVAL");

  if (loading) {
    return (
      <BorrowerShell active="dashboard" pageTitle={t("titles.borrowerDashboard")}>
        <Head>
          <title>{t("titles.borrowerDashboard")}</title>
        </Head>
        <SkeletonDashboard />
      </BorrowerShell>
    );
  }

  const userName = firstName(profile?.name, t("borrower.borrowerFallback", "there"));

  return (
    <BorrowerShell active="dashboard" pageTitle={t("titles.borrowerDashboard")}>
      <Head>
        <title>{t("titles.borrowerDashboard")}</title>
      </Head>

      <AppTopbar
        eyebrow={t("borrower.dashboardEyebrow", "대시보드")}
        title={
          <>
            {t("borrower.welcome", "안녕하세요,")}{" "}
            <span className="italic text-amber-600">{userName}</span>
            {t("borrower.welcomeSuffix", "님.")}
          </>
        }
        actions={
          <Btn as="a" href="/borrower/request/new" size="sm">
            + {t("borrowerDashboard.newRequest", "새 요청")}
          </Btn>
        }
      />

      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-sm border border-error-100 bg-error-50 px-4 py-3 font-body text-[13px] text-error-700"
          >
            {t("borrowerDashboard.failedToLoad")}
          </div>
        )}

        {/* Priority action banner */}
        {rejectedReq ? (
          <ActionBanner
            tone="danger"
            eyebrow={t("borrower.actionRequired", "확인 필요")}
            title={t("request.rejectedTitle", "Request Not Approved")}
            body={
              rejectedReq && "rejectionReason" in rejectedReq
                ? String(
                    (rejectedReq as { rejectionReason?: string })
                      .rejectionReason ??
                      t("request.rejectedNote", "This request was not approved."),
                  )
                : t("request.rejectedNote", "This request was not approved.")
            }
            cta={
              <Btn
                as="a"
                size="sm"
                variant="ghost"
                href={`/borrower/request/${rejectedReq.publicId}`}
              >
                {t("request.viewDetails", "View details")}
              </Btn>
            }
            className="mb-6"
          />
        ) : pendingReq ? (
          <ActionBanner
            tone="warning"
            eyebrow={t("borrower.actionRequired", "확인 필요")}
            title={t("status.pendingApproval", "Pending Approval")}
            body={t(
              "request.pendingApprovalNote",
              "Your request is under review. You'll be notified once approved.",
            )}
            cta={
              <Btn
                as="a"
                size="sm"
                variant="ghost"
                href={`/borrower/request/${pendingReq.publicId}`}
              >
                {t("request.viewDetails", "View details")}
              </Btn>
            }
            className="mb-6"
          />
        ) : null}

        {/* Empty state — no requests yet */}
        {requests.length === 0 ? (
          <Card padding="lg" className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-sm border border-cream-300 bg-cream-200 font-display text-2xl text-forest-700">
              +
            </div>
            <div className="font-display text-2xl font-semibold text-forest-800">
              {t("borrowerDashboard.noRequests")}
            </div>
            <p className="mx-auto mt-3 max-w-md font-body text-[14px] text-forest-700/80">
              {t("borrowerDashboard.noRequestsDesc")}
            </p>
            <div className="mt-6 flex justify-center">
              <Btn as="a" href="/borrower/request/new">
                {t("borrowerDashboard.createFirst", "Create your first request")}
              </Btn>
            </div>
          </Card>
        ) : (
          <>
            {/* Stats row — 2 stats only */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatCard
                label={t("borrowerDashboard.statActive", "Active requests")}
                value={activeCount}
                trend={
                  activeCount === 0
                    ? t("borrowerDashboard.noActive", "No active requests")
                    : t(
                        "borrowerDashboard.activeTrend",
                        "{{total}} total request(s)",
                        { total: requests.length },
                      )
                }
              />
              <StatCard
                label={t("borrowerDashboard.statOffers", "Broker responses")}
                value={totalResponses}
                accent={totalResponses > 0}
                trend={
                  totalResponses === 0
                    ? t(
                        "borrowerDashboard.responsesWaiting",
                        "Waiting for brokers to respond",
                      )
                    : t(
                        "borrowerDashboard.responsesAcross",
                        "Across {{count}} request(s)",
                        { count: requests.length },
                      )
                }
              />
            </div>

            {/* Active request hero + activity */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <ActiveRequestHero
                  request={activeRequest}
                  locale={locale}
                  t={t}
                />
              </div>
              <div className="lg:col-span-2">
                <Card padding="none" className="overflow-hidden">
                  <div className="flex items-center justify-between border-b border-cream-300 px-5 py-4">
                    <SectionHead
                      eyebrow={t("borrower.activityEyebrow", "최근 활동")}
                      title={t("borrower.activityTitle", "최근 응답")}
                    />
                    <Link
                      href="/borrower/messages"
                      className="font-body text-[12px] font-semibold text-forest-700 hover:text-amber-600"
                    >
                      {t("borrower.viewAll", "모두 보기")} →
                    </Link>
                  </div>
                  {recentActivity.length === 0 ? (
                    <div className="p-5">
                      <EmptyState
                        title={t(
                          "borrower.noActivity",
                          "No activity yet",
                        )}
                        body={t(
                          "borrower.noActivityDesc",
                          "When brokers respond, you'll see their messages here.",
                        )}
                      />
                    </div>
                  ) : (
                    <ul>
                      {recentActivity.map((c) => {
                        const last = c.messages[c.messages.length - 1];
                        const hasUnread = (c.unreadCount ?? 0) > 0;
                        return (
                          <li key={c.id}>
                            <Link
                              href={`/borrower/messages?id=${c.id}`}
                              className="block border-b border-cream-200 px-5 py-3.5 transition-colors last:border-b-0 hover:bg-cream-100"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-body text-[13px] font-semibold text-forest-800">
                                  {c.broker?.user?.name ||
                                    c.broker?.brokerageName ||
                                    t(
                                      "borrower.brokerLabel",
                                      "Broker",
                                    )}
                                </span>
                                <span
                                  className={`font-mono text-[10px] ${
                                    hasUnread
                                      ? "font-semibold text-amber-600"
                                      : "text-sage-400"
                                  }`}
                                >
                                  {relativeTime(
                                    last?.createdAt ?? c.updatedAt,
                                    locale,
                                  )}
                                </span>
                              </div>
                              {c.request && (
                                <div className="mt-0.5 truncate font-mono text-[11px] text-sage-500">
                                  {getRequestTitle(c.request)}
                                  {c.request.province
                                    ? ` · ${c.request.province}`
                                    : ""}
                                </div>
                              )}
                              {last && (
                                <p
                                  className={`mt-1 truncate font-body text-[12px] ${
                                    hasUnread ? "text-forest-800" : "text-sage-500"
                                  }`}
                                >
                                  {last.body}
                                </p>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              </div>
            </div>

            {/* All requests list */}
            <div className="mt-8">
              <SectionHead
                eyebrow={t("borrower.allRequestsEyebrow", "내 요청")}
                title={t("borrower.allRequestsTitle", "모든 요청")}
                size="md"
              />
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {requests.map((req) => (
                  <RequestCard
                    key={req.id}
                    request={req}
                    locale={locale}
                    t={t}
                  />
                ))}
              </div>
              <p className="mt-6 text-center font-body text-xs text-forest-700/50">
                {t("request.expirationNote")}
              </p>
            </div>
          </>
        )}
      </div>
    </BorrowerShell>
  );
}

// ──────────────────────────────────────────────────────────────
// Active request hero — surfaces the most-recent open or
// in-progress request with the data we actually have. No rate
// fields (broker proposals were intentionally removed).
// ──────────────────────────────────────────────────────────────
function ActiveRequestHero({
  request,
  locale,
  t,
}: {
  request: DashboardRequest | null;
  locale: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  if (!request) {
    return (
      <Card padding="lg">
        <Eyebrow>{t("borrower.activeRequestEyebrow", "활성 요청")}</Eyebrow>
        <div className="mt-2 font-display text-xl font-semibold text-forest-800">
          {t(
            "borrower.noActiveRequest",
            "No active requests right now",
          )}
        </div>
        <p className="mt-2 font-body text-[13px] text-sage-500">
          {t(
            "borrower.noActiveRequestDesc",
            "Start a new request to invite verified brokers to respond.",
          )}
        </p>
        <div className="mt-4">
          <Btn as="a" href="/borrower/request/new" size="md">
            + {t("borrowerDashboard.newRequest", "New request")}
          </Btn>
        </div>
      </Card>
    );
  }

  const category =
    request.mortgageCategory === "COMMERCIAL"
      ? t("request.commercial")
      : t("request.residential");
  const region = request.city
    ? `${request.city}, ${request.province}`
    : request.province;
  const responses =
    request._count?.conversations ?? request.conversations?.length ?? 0;
  const firstProduct = (request.productTypes ?? [])[0];

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="border-b border-cream-300 px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <Eyebrow>{t("borrower.activeRequestEyebrow", "활성 요청")}</Eyebrow>
          <span className="font-mono text-[11px] text-sage-500">
            #{request.publicId} · {relativeTime(request.createdAt, locale)}
          </span>
        </div>
        <div className="mt-2 font-display text-2xl font-semibold leading-snug text-forest-800">
          {category}
          {firstProduct && (
            <>
              <span className="text-sage-400"> · </span>
              <span className="text-amber-600 italic">
                {t(PRODUCT_LABEL_KEYS[firstProduct] ?? firstProduct)}
              </span>
            </>
          )}
        </div>
        <div className="mt-1 font-body text-[13px] text-forest-700/80">
          {region}
          {request.desiredTimeline && (
            <>
              {" · "}
              {t(
                TIMELINE_LABEL_KEYS[request.desiredTimeline] ??
                  request.desiredTimeline,
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 border-b border-cream-300">
        <div className="px-5 py-4 border-r border-cream-300">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-sage-500">
            {t("borrower.responses", "응답")}
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-forest-800">
            {responses}
          </div>
        </div>
        <div className="px-5 py-4 border-r border-cream-300">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-sage-500">
            {t("status.title", "Status")}
          </div>
          <div className="mt-2">
            <StatusBadge status={request.status} />
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-sage-500">
            {t("borrower.posted", "게시됨")}
          </div>
          <div className="mt-1 font-body text-[13px] font-medium text-forest-800">
            {new Date(request.createdAt).toLocaleDateString(
              locale === "ko" ? "ko-KR" : "en-CA",
              { month: "short", day: "numeric" },
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 py-4">
        <Btn
          as="a"
          href={`/borrower/brokers/${request.publicId}`}
          size="md"
        >
          {t("borrower.viewResponses", "응답 보기")} →
        </Btn>
        <Btn
          as="a"
          href={`/borrower/request/${request.publicId}`}
          variant="ghost"
          size="md"
        >
          {t("borrower.editRequest", "요청 편집")}
        </Btn>
        {responses > 0 && (
          <Badge tone="accent">
            {t("borrower.activeResponsesBadge", "{{count}} 새 응답", {
              count: responses,
            })}
          </Badge>
        )}
      </div>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────
// Request card — compact tile for the all-requests list.
// ──────────────────────────────────────────────────────────────
function RequestCard({
  request,
  locale,
  t,
}: {
  request: DashboardRequest;
  locale: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  const isDimmed = request.status === "EXPIRED" || request.status === "REJECTED";
  const responses =
    request._count?.conversations ?? request.conversations?.length ?? 0;
  return (
    <Link
      href={`/borrower/request/${request.publicId}`}
      className={`group block rounded-sm border border-cream-300 bg-cream-50 p-4 transition-colors hover:border-forest-300 hover:bg-cream-100 ${
        isDimmed ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge
          tone={request.mortgageCategory === "COMMERCIAL" ? "accent" : "neutral"}
        >
          {request.mortgageCategory === "COMMERCIAL"
            ? t("request.commercial")
            : t("request.residential")}
        </Badge>
        <StatusBadge status={request.status} />
      </div>
      <div className="mt-2 font-body text-[13px] font-semibold text-forest-800">
        {request.city ? `${request.city}, ` : ""}
        {request.province || "—"}
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-sage-500">
        #{request.publicId} · {relativeTime(request.createdAt, locale)}
      </div>
      {(request.productTypes ?? []).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {(request.productTypes ?? []).slice(0, 3).map((pt) => (
            <span
              key={pt}
              className="inline-flex items-center rounded-sm border border-cream-300 bg-cream-50 px-1.5 py-0.5 font-body text-[11px] text-forest-700"
            >
              {t(PRODUCT_LABEL_KEYS[pt] ?? pt)}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-cream-200 pt-2">
        <span className="font-mono text-[11px] text-sage-500">
          {responses}{" "}
          {responses === 1
            ? t("borrowerDashboard.response", "response")
            : t("borrowerDashboard.responsesPlural", "responses")}
        </span>
        <span className="font-mono text-[11px] font-semibold text-forest-700 transition-colors group-hover:text-amber-600">
          {t("common.open", "Open")} →
        </span>
      </div>
    </Link>
  );
}

// ──────────────────────────────────────────────────────────────
// ActionBanner — same pattern as broker dashboard.
// ──────────────────────────────────────────────────────────────
function ActionBanner({
  tone,
  eyebrow,
  title,
  body,
  cta,
  className = "",
}: {
  tone: "warning" | "danger" | "info";
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  body: React.ReactNode;
  cta?: React.ReactNode;
  className?: string;
}) {
  const toneClass: Record<typeof tone, string> = {
    warning: "bg-warning-50 border-warning-100",
    danger: "bg-error-50 border-error-100",
    info: "bg-info-50 border-info-100",
  };
  const accent: Record<typeof tone, string> = {
    warning: "text-warning-700",
    danger: "text-error-700",
    info: "text-info-700",
  };
  return (
    <div
      className={`flex flex-col gap-3 rounded-sm border px-5 py-4 sm:flex-row sm:items-center sm:gap-5 ${toneClass[tone]} ${className}`}
    >
      <div className="flex-1 min-w-0">
        <Eyebrow className={accent[tone]}>{eyebrow}</Eyebrow>
        <div className="mt-1 font-body text-sm font-semibold text-forest-800">
          {title}
        </div>
        <p className="mt-1 font-body text-[13px] text-forest-700/80">{body}</p>
      </div>
      {cta && <div className="shrink-0">{cta}</div>}
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});
