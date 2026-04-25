import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import BrokerShell from "@/components/broker/BrokerShell";
import { useBrokerData } from "@/components/broker/BrokerDataContext";
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
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import {
  PRODUCT_LABEL_KEYS,
  TIMELINE_LABEL_KEYS,
  getRequestTitle,
} from "@/lib/requestConfig";

interface BrokerRequest {
  id: string;
  publicId: string;
  mortgageCategory: "RESIDENTIAL" | "COMMERCIAL" | null;
  productTypes?: string[] | null;
  province: string;
  city?: string | null;
  desiredTimeline?: string | null;
  createdAt: string;
  isNew?: boolean;
  _count?: { conversations: number };
}

interface DashboardConversation {
  id: string;
  publicId?: string;
  status: string;
  updatedAt: string;
  unreadCount?: number;
  messages: { body: string; createdAt: string; senderId: string }[];
  borrower: { id: string; name: string | null };
  request: { id: string; province: string; mortgageCategory?: string | null };
}

function relativeTime(date: string, locale: string) {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = Math.max(0, now - then);
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return locale === "ko" ? "방금" : "just now";
  if (m < 60) return locale === "ko" ? `${m}분 전` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return locale === "ko" ? `${h}시간 전` : `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return locale === "ko" ? `${d}일 전` : `${d}d ago`;
  return new Date(date).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-CA", {
    month: "short",
    day: "numeric",
  });
}

function firstName(fullName: string | null | undefined, fallback: string) {
  if (!fullName) return fallback;
  const first = fullName.split(" ")[0];
  return first || fallback;
}

export default function BrokerDashboardPage() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const { profile, profileChecked, counters } = useBrokerData();

  const [recentRequests, setRecentRequests] = useState<BrokerRequest[]>([]);
  const [recentConversations, setRecentConversations] = useState<
    DashboardConversation[]
  >([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(false);

  // One-time congrats banner. localStorage can be unavailable (private mode,
  // jsdom harness); treat access as best-effort.
  useEffect(() => {
    if (profile?.verificationStatus !== "VERIFIED") return;
    const key = `mm_verified_seen_${profile.id}`;
    try {
      if (typeof window !== "undefined" && !window.localStorage?.getItem(key)) {
        setShowVerifiedBanner(true);
        window.localStorage?.setItem(key, "1");
      }
    } catch {
      // no-op — storage may be disabled
    }
  }, [profile?.id, profile?.verificationStatus]);

  // Dashboard-specific lists: top 5 requests + top 3 active conversations.
  // `t` intentionally omitted — it's a stable reference in production but the
  // test harness recreates it every render, which would flap the effect.
  useEffect(() => {
    if (!profileChecked || !profile) return;
    let cancelled = false;
    (async () => {
      setLoadingLists(true);
      setListError(null);
      try {
        const [reqRes, convRes] = await Promise.all([
          fetch("/api/requests?limit=5"),
          fetch("/api/conversations"),
        ]);
        if (cancelled) return;
        if (reqRes.ok) {
          const json = await reqRes.json();
          setRecentRequests((json.data ?? []) as BrokerRequest[]);
        } else if (reqRes.status !== 403) {
          setListError("error");
        }
        if (convRes.ok) {
          const convs = (await convRes.json()) as DashboardConversation[];
          setRecentConversations(
            convs.filter((c) => c.status === "ACTIVE").slice(0, 3),
          );
        }
      } catch {
        if (!cancelled) setListError("error");
      } finally {
        if (!cancelled) setLoadingLists(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileChecked, profile?.id]);

  if (!profileChecked) {
    return (
      <BrokerShell active="dashboard" pageTitle={t("titles.brokerDashboard")}>
        <Head>
          <title>{t("titles.brokerDashboard")}</title>
        </Head>
        <SkeletonDashboard />
      </BrokerShell>
    );
  }

  if (!profile) {
    // BrokerDataContext has already redirected to /broker/onboarding;
    // render nothing while the transition happens.
    return (
      <BrokerShell active="dashboard" pageTitle={t("titles.brokerDashboard")}>
        <Head>
          <title>{t("titles.brokerDashboard")}</title>
        </Head>
      </BrokerShell>
    );
  }

  const tier = profile.subscriptionTier || "BASIC";
  const unlimited = tier === "PREMIUM";
  const verified = profile.verificationStatus === "VERIFIED";
  const brokerGivenName = firstName(profile.user?.name, t("broker.brokerFallback", "Broker"));

  // ── Action strip ─────────────────────────────────────────────
  // Priority: NOT_VERIFIED > OUT_OF_CREDITS > FREE_PLAN_HINT.
  // Only the top-priority banner renders; the dashboard feels calm.
  let actionBanner: React.ReactNode = null;
  if (!verified && profile.verificationStatus !== "REJECTED") {
    actionBanner = (
      <ActionBanner
        tone="warning"
        eyebrow={t("broker.actionRequired", "Action required")}
        title={t("broker.pendingTitle")}
        body={t("broker.pendingDesc")}
      />
    );
  } else if (profile.verificationStatus === "REJECTED") {
    actionBanner = (
      <ActionBanner
        tone="danger"
        eyebrow={t("broker.actionRequired", "Action required")}
        title={t("broker.rejectedTitle", "Verification rejected")}
        body={t(
          "broker.rejectedDesc",
          "Please contact support to review your broker profile.",
        )}
      />
    );
  } else if (!unlimited && profile.responseCredits === 0) {
    actionBanner = (
      <ActionBanner
        tone="warning"
        eyebrow={t("broker.actionRequired", "Action required")}
        title={t("credits.noCreditsMessage")}
        body={t(
          "broker.noCreditsSubtitle",
          "Upgrade your plan or buy more credits to continue responding to requests.",
        )}
        cta={
          <Btn as="a" href="/broker/billing" size="sm">
            {t("credits.upgradePlan")}
          </Btn>
        }
      />
    );
  } else if (verified && tier === "FREE") {
    actionBanner = (
      <ActionBanner
        tone="info"
        eyebrow={t("broker.upgrade", "Upgrade")}
        title={t("broker.freePlanTitle")}
        body={t("broker.freePlanDesc")}
        cta={
          <Btn as="a" href="/broker/billing" size="sm">
            {t("broker.upgradePlan")}
          </Btn>
        }
      />
    );
  }

  const locale = router.locale === "ko" ? "ko" : "en";

  return (
    <BrokerShell active="dashboard" pageTitle={t("titles.brokerDashboard")}>
      <Head>
        <title>{t("titles.brokerDashboard")}</title>
      </Head>

      <AppTopbar
        eyebrow={t("broker.dashboardEyebrow", "전문가 대시보드")}
        title={
          <>
            {t("broker.welcomeTo", "오늘도 반갑습니다,")}{" "}
            <span className="italic text-amber-600">{brokerGivenName}</span>
            {t("broker.welcomeSuffix", "님.")}
          </>
        }
        actions={
          <>
            <Badge tone={tier === "PRO" || tier === "PREMIUM" ? "accent" : "neutral"}>
              {tier}
            </Badge>
            <div className="hidden sm:flex items-center gap-1 rounded-sm border border-cream-300 bg-cream-50 px-3 py-1 font-mono text-[11px] text-sage-500">
              <span className="text-amber-600">●</span>
              {t("broker.responseCredits", "Credits")}:{" "}
              <span className="font-semibold text-forest-800">
                {unlimited ? t("common.unlimited") : profile.responseCredits}
              </span>
            </div>
            <Btn as="a" href="/broker/requests" size="sm" variant="dark">
              {t("broker.findRequests", "상담 찾기")}
            </Btn>
          </>
        }
      />

      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        {showVerifiedBanner && (
          <div className="mb-6 flex items-start gap-3 rounded-sm border border-success-100 bg-success-50 px-5 py-4">
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-success-700"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <div className="font-body text-sm font-semibold text-success-700">
                {t("broker.verifiedTitle")}
              </div>
              <p className="mt-1 font-body text-[13px] text-success-700/80">
                {t("broker.verifiedDesc")}
              </p>
            </div>
            <button
              onClick={() => setShowVerifiedBanner(false)}
              className="text-success-700/60 hover:text-success-700"
              aria-label={t("common.dismiss", "Dismiss")}
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
          </div>
        )}

        {actionBanner && <div className="mb-6">{actionBanner}</div>}

        {/* Stats: 2-col (no 응답률, no credits — credits live in topbar chip) */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            label={t("broker.newRequestsWeek", "New requests · this week")}
            value={counters.newRequests}
            trend={
              counters.newRequests === 0
                ? t("browse.allCaughtUp", "All caught up")
                : t("broker.tapToReview", "Tap to review")
            }
          />
          <StatCard
            label={t("broker.activeConvos", "Active Conversations")}
            value={counters.activeConversations}
            accent={counters.unreadMessages > 0}
            trend={
              counters.unreadMessages > 0
                ? t("broker.unreadAwaiting", "{{count}} unread messages", {
                    count: counters.unreadMessages,
                  })
                : t("broker.noUnread", "No unread messages")
            }
          />
        </div>

        {/* Two-column content area */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Card padding="none" className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-cream-300 px-5 py-4">
                <SectionHead
                  eyebrow={t("broker.latestRequests", "최신 요청")}
                  title={t("broker.newRequestsTitle", "새로운 상담 요청")}
                />
                <Link
                  href="/broker/requests"
                  className="font-body text-[12px] font-semibold text-forest-700 hover:text-amber-600"
                >
                  {t("broker.seeAll", "모두 보기")} →
                </Link>
              </div>
              {listError && (
                <div
                  role="alert"
                  className="border-b border-error-100 bg-error-50 px-5 py-3 text-[13px] text-error-700"
                >
                  {t("broker.failedToFetchRequests")}
                </div>
              )}
              {loadingLists ? (
                <div className="px-5 py-10 text-center font-body text-[13px] text-sage-500">
                  {t("broker.loadingRequests")}
                </div>
              ) : recentRequests.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title={t("broker.noMatchingRequests")}
                    body={
                      verified
                        ? t(
                            "broker.allCaughtUpDesc",
                            "No new requests match your coverage right now — we'll surface them here as they arrive.",
                          )
                        : t(
                            "broker.pendingDesc",
                            "Verification in progress — the marketplace opens automatically once approved.",
                          )
                    }
                    cta={
                      verified ? (
                        <Btn as="a" href="/broker/requests" size="sm" variant="ghost">
                          {t("broker.goToRequests", "Browse all")}
                        </Btn>
                      ) : null
                    }
                  />
                </div>
              ) : (
                <ul>
                  {recentRequests.slice(0, 5).map((r, i) => {
                    const label =
                      r.mortgageCategory === "COMMERCIAL"
                        ? t("request.commercial")
                        : t("request.residential");
                    const place = r.city ? `${r.city}, ${r.province}` : r.province;
                    const firstProduct = (r.productTypes ?? [])[0];
                    return (
                      <li key={r.id}>
                        <Link
                          href={`/broker/requests/${r.publicId}`}
                          className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-cream-200 px-5 py-3.5 transition-colors last:border-b-0 hover:bg-cream-100"
                        >
                          <span className="flex items-center gap-2 font-mono text-[11px] text-sage-500">
                            {r.isNew && (
                              <span
                                aria-label="New"
                                className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
                              />
                            )}
                            #{r.publicId}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-body text-[13px] font-semibold text-forest-800">
                              {label}
                              {firstProduct ? (
                                <span className="text-sage-500">
                                  {" · "}
                                  {t(PRODUCT_LABEL_KEYS[firstProduct] ?? firstProduct)}
                                </span>
                              ) : null}
                            </span>
                            <span className="block truncate font-body text-[12px] text-sage-500">
                              {place}
                              {r.desiredTimeline ? (
                                <>
                                  {" · "}
                                  {t(
                                    TIMELINE_LABEL_KEYS[r.desiredTimeline] ??
                                      r.desiredTimeline,
                                  )}
                                </>
                              ) : null}
                              {" · "}
                              {relativeTime(r.createdAt, locale)}
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-forest-700 group-hover:text-amber-600">
                            {t("broker.respond", "상담 시작")} →
                          </span>
                          <span className="hidden" aria-hidden>
                            {i}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card padding="none" className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-cream-300 px-5 py-4">
                <SectionHead
                  eyebrow={t("broker.activeEyebrow", "진행 중")}
                  title={t("broker.activeConvos", "진행 중 대화")}
                />
                <Link
                  href="/broker/messages"
                  className="font-body text-[12px] font-semibold text-forest-700 hover:text-amber-600"
                >
                  {t("broker.seeAll", "모두 보기")} →
                </Link>
              </div>
              {loadingLists ? (
                <div className="px-5 py-8 text-center font-body text-[13px] text-sage-500">
                  {t("messages.loadingConversations", "Loading…")}
                </div>
              ) : recentConversations.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title={t("messages.noConversations")}
                    body={t("messages.noConversationsDescBroker")}
                    cta={
                      <Btn as="a" href="/broker/requests" size="sm" variant="ghost">
                        {t("broker.goToRequests", "Browse requests")}
                      </Btn>
                    }
                  />
                </div>
              ) : (
                <ul>
                  {recentConversations.map((c) => {
                    const last = c.messages[c.messages.length - 1];
                    const hasUnread = (c.unreadCount ?? 0) > 0;
                    return (
                      <li key={c.id}>
                        <Link
                          href={`/broker/messages?id=${c.id}`}
                          className="block border-b border-cream-200 px-5 py-3.5 transition-colors last:border-b-0 hover:bg-cream-100"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-body text-[13px] font-semibold text-forest-800">
                              {c.borrower?.name || t("messages.borrowerLabel")}
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
                          <div className="mt-0.5 truncate font-mono text-[11px] text-sage-500">
                            {getRequestTitle(c.request)}
                            {" · "}
                            {c.request.province}
                          </div>
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
      </div>
    </BrokerShell>
  );
}

// ──────────────────────────────────────────────────────────────
// Local: ActionBanner
// Single-line attention strip; content varies by priority above.
// ──────────────────────────────────────────────────────────────
function ActionBanner({
  tone,
  eyebrow,
  title,
  body,
  cta,
}: {
  tone: "warning" | "danger" | "info";
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  body: React.ReactNode;
  cta?: React.ReactNode;
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
      className={`flex flex-col gap-3 rounded-sm border px-5 py-4 sm:flex-row sm:items-center sm:gap-5 ${toneClass[tone]}`}
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
