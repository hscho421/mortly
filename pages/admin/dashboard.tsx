import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import Head from "next/head";
import AdminLayout from "@/components/AdminLayout";
import { SkeletonAdminDashboard } from "@/components/Skeleton";
import dynamic from "next/dynamic";

const TrendChart = dynamic(() => import("@/components/TrendChart"), {
  ssr: false,
  loading: () => <div style={{ height: 240 }} />,
});

interface DashboardStats {
  users: number;
  totalBorrowers: number;
  totalBrokers: number;
  pendingVerifications: number;
  verifiedBrokers: number;
  rejectedBrokers: number;
  requestsByStatus: {
    pendingApproval: number;
    open: number;
    inProgress: number;
    closed: number;
    expired: number;
    rejected: number;
    total: number;
  };
  activeConversations: number;
  totalConversations: number;
  openReports: number;
}

interface TrendDay {
  date: string;
  users: number;
  requests: number;
  conversations: number;
}

interface PendingBroker {
  id: string;
  userName: string;
  brokerageName: string;
  province: string;
  createdAt: string;
}

interface PendingRequest {
  id: string;
  publicId: string;
  borrowerName: string;
  province: string;
  createdAt: string;
}

interface OpenReport {
  id: string;
  targetType: string;
  reason: string;
  reporterName: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trends, setTrends] = useState<TrendDay[]>([]);
  const [loading, setLoading] = useState(true);

  const [pendingBrokers, setPendingBrokers] = useState<PendingBroker[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [openReports, setOpenReports] = useState<OpenReport[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const hasFetched = useRef(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") return;
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchData = async () => {
      try {
        const [statsResult, trendsResult, brokersResult, requestsResult, reportsResult] = await Promise.allSettled([
          fetch("/api/admin/stats"),
          fetch("/api/admin/trends"),
          fetch("/api/admin/brokers?status=PENDING&limit=5"),
          fetch("/api/admin/requests?status=PENDING_APPROVAL&limit=5"),
          fetch("/api/admin/reports?status=OPEN&limit=5"),
        ]);

        if (statsResult.status === "fulfilled" && statsResult.value.ok) setStats(await statsResult.value.json());
        if (trendsResult.status === "fulfilled" && trendsResult.value.ok) setTrends(await trendsResult.value.json());

        if (brokersResult.status === "fulfilled" && brokersResult.value.ok) {
          const json = await brokersResult.value.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setPendingBrokers((json.data || []).slice(0, 5).map((b: any) => ({
            id: b.id,
            userName: b.user?.name ?? "Unknown",
            brokerageName: b.brokerageName,
            province: b.province,
            createdAt: b.createdAt?.slice(0, 10) ?? "",
          })));
        }

        if (requestsResult.status === "fulfilled" && requestsResult.value.ok) {
          const json = await requestsResult.value.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setPendingRequests((json.data || []).slice(0, 5).map((r: any) => ({
            id: r.id,
            publicId: r.publicId,
            borrowerName: r.borrower?.name ?? r.borrower?.email ?? "Unknown",
            province: r.province,
            createdAt: r.createdAt?.slice(0, 10) ?? "",
          })));
        }

        if (reportsResult.status === "fulfilled" && reportsResult.value.ok) {
          const json = await reportsResult.value.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setOpenReports((json.data || []).slice(0, 5).map((r: any) => ({
            id: r.id,
            targetType: r.targetType,
            reason: r.reason,
            reporterName: r.reporter?.name ?? r.reporter?.email ?? "Unknown",
            createdAt: r.createdAt?.slice(0, 10) ?? "",
          })));
        }
      } catch {
        // Network error
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session, status]);

  const handleVerifyBroker = useCallback(async (brokerId: string, decision: "VERIFIED" | "REJECTED") => {
    setActionLoading(brokerId);
    try {
      const res = await fetch(`/api/admin/brokers/${brokerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationStatus: decision }),
      });
      if (res.ok) {
        setPendingBrokers((prev) => prev.filter((b) => b.id !== brokerId));
        setStats(prev => prev ? { ...prev, pendingVerifications: Math.max(0, prev.pendingVerifications - 1) } : prev);
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleApproveRequest = useCallback(async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const res = await fetch(`/api/admin/requests/${requestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "OPEN" }),
      });
      if (res.ok) {
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
        setStats(prev => prev ? {
          ...prev,
          requestsByStatus: {
            ...prev.requestsByStatus,
            pendingApproval: Math.max(0, prev.requestsByStatus.pendingApproval - 1),
            open: prev.requestsByStatus.open + 1,
          },
        } : prev);
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  }, []);

  if (status === "loading" || loading) {
    return (
      <AdminLayout>
        <SkeletonAdminDashboard />
      </AdminLayout>
    );
  }

  if (!session || session.user.role !== "ADMIN") {
    return null;
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr + "T12:00:00").toLocaleDateString(
        router.locale === "ko" ? "ko-KR" : "en-CA",
        { month: "short", day: "numeric" }
      );
    } catch {
      return dateStr;
    }
  };

  // Unified inbox-first action queue — one ordered list of items needing admin action
  type ActionItem =
    | { kind: "broker"; id: string; title: string; sub: string; date: string }
    | { kind: "request"; id: string; title: string; sub: string; date: string }
    | { kind: "report"; id: string; title: string; sub: string; date: string };

  const inboxItems: ActionItem[] = [
    ...pendingRequests.map<ActionItem>((r) => ({
      kind: "request",
      id: r.id,
      title: `${r.borrowerName} · ${r.province}`,
      sub: `#${r.publicId}`,
      date: r.createdAt,
    })),
    ...pendingBrokers.map<ActionItem>((b) => ({
      kind: "broker",
      id: b.id,
      title: `${b.userName}`,
      sub: `${b.brokerageName} · ${b.province}`,
      date: b.createdAt,
    })),
    ...openReports.map<ActionItem>((r) => ({
      kind: "report",
      id: r.id,
      title: r.reason,
      sub: `${r.targetType} · ${t("admin.by")} ${r.reporterName}`,
      date: r.createdAt,
    })),
  ];

  const inboxTotal = (stats?.requestsByStatus.pendingApproval ?? 0)
    + (stats?.pendingVerifications ?? 0)
    + (stats?.openReports ?? 0);

  return (
    <AdminLayout>
      <Head><title>{t("titles.adminDashboard")}</title></Head>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header — editorial with action callout */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-fade-in">
          <div>
            <div className="eyebrow">— {t("admin.dashboard")}</div>
            <h1 className="heading-lg mt-3">
              {inboxTotal > 0 ? (
                <>
                  {t("admin.actionRequired")}{" "}
                  <em className="italic text-amber-500">· {inboxTotal}</em>
                </>
              ) : (
                t("admin.dashboard")
              )}
            </h1>
            <p className="text-body-sm mt-2 max-w-2xl">{t("admin.dashboardDescription", "Overview of platform activity and key metrics.")}</p>
          </div>
        </div>

        {/* Unified Inbox — Action Required */}
        <div className="mb-8 rounded-sm bg-cream-50 border-2 border-forest-800 animate-fade-in-up opacity-0">
          <div className="flex items-baseline justify-between p-5 border-b border-cream-300">
            <div className="flex items-baseline gap-3">
              <h2 className="heading-sm">{t("admin.actionRequired")}</h2>
              <span className="font-mono text-xs text-sage-500">{inboxTotal}</span>
              {inboxTotal > 0 && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="badge-neutral">
                {t("admin.sidebar.requestApprovals")} · {stats?.requestsByStatus.pendingApproval ?? 0}
              </span>
              <span className="badge-neutral">
                {t("admin.sidebar.verification")} · {stats?.pendingVerifications ?? 0}
              </span>
              <span className="badge-neutral">
                {t("admin.reports")} · {stats?.openReports ?? 0}
              </span>
            </div>
          </div>
          {inboxItems.length === 0 ? (
            <div className="p-10 text-center text-body-sm">
              {t("admin.queue.noPendingRequests", "No pending items")}
            </div>
          ) : (
            <ul>
              {inboxItems.map((it, idx) => {
                const tone =
                  it.kind === "request" ? "badge-accent" :
                  it.kind === "broker" ? "badge-info" :
                  "badge-error";
                const label =
                  it.kind === "request" ? t("admin.sidebar.requestApprovals") :
                  it.kind === "broker" ? t("admin.sidebar.verification") :
                  t("admin.reports");
                const viewHref =
                  it.kind === "request" ? `/admin/requests?status=PENDING_APPROVAL` :
                  it.kind === "broker" ? `/admin/brokers/${it.id}` :
                  `/admin/reports?status=OPEN`;
                return (
                  <li
                    key={`${it.kind}-${it.id}`}
                    className={`grid grid-cols-[90px_110px_1fr_auto] gap-4 items-center px-5 py-3.5 ${idx !== 0 ? "border-t border-cream-200" : ""}`}
                  >
                    <span className={`badge ${tone}`}>{label}</span>
                    <span className="font-mono text-[11px] text-sage-500 truncate">
                      {it.kind === "request" ? `#${it.sub.replace("#", "")}` : it.id.slice(0, 10)}
                    </span>
                    <div className="min-w-0">
                      <div className="font-body text-sm text-forest-800 font-medium truncate">{it.title}</div>
                      <div className="font-body text-xs text-sage-500 truncate">{it.sub}</div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      {it.kind === "broker" && (
                        <>
                          <button
                            onClick={() => handleVerifyBroker(it.id, "VERIFIED")}
                            disabled={actionLoading === it.id}
                            className="rounded-sm bg-success-700 px-3 py-1.5 font-body text-[11px] font-semibold text-white transition-all hover:bg-success-600 disabled:opacity-50"
                          >
                            ✓ {t("admin.approve")}
                          </button>
                          <button
                            onClick={() => handleVerifyBroker(it.id, "REJECTED")}
                            disabled={actionLoading === it.id}
                            className="rounded-sm border border-red-200 bg-red-50 text-red-600 px-3 py-1.5 font-body text-[11px] font-semibold transition-all hover:bg-red-100 disabled:opacity-50"
                          >
                            {t("admin.reject")}
                          </button>
                        </>
                      )}
                      {it.kind === "request" && (
                        <button
                          onClick={() => handleApproveRequest(it.id)}
                          disabled={actionLoading === it.id}
                          className="rounded-sm bg-success-700 px-3 py-1.5 font-body text-[11px] font-semibold text-white transition-all hover:bg-success-600 disabled:opacity-50"
                        >
                          ✓ {t("admin.approve")}
                        </button>
                      )}
                      <Link
                        href={viewHref}
                        className="rounded-sm border border-cream-300 bg-cream-50 text-forest-800 px-3 py-1.5 font-body text-[11px] font-semibold hover:bg-cream-200"
                      >
                        {t("admin.view")}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {inboxTotal > inboxItems.length && (
            <div className="px-5 py-3 border-t border-cream-200 text-center font-mono text-[11px] text-sage-500 uppercase tracking-[0.12em]">
              + {inboxTotal - inboxItems.length} more
            </div>
          )}
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            <div className="card-elevated animate-fade-in-up opacity-0 stagger-1">
              <div className="mono-label mb-3">{t("admin.usersSection")}</div>
              <dl className="grid grid-cols-3 gap-3">
                <div>
                  <dt className="mono-label">{t("admin.totalUsers")}</dt>
                  <dd className="mt-1 font-display font-semibold text-3xl tracking-[-0.03em] text-forest-800">{stats.users}</dd>
                </div>
                <div>
                  <dt className="mono-label">{t("admin.totalBorrowers")}</dt>
                  <dd className="mt-1 font-display font-semibold text-3xl tracking-[-0.03em] text-forest-800">{stats.totalBorrowers}</dd>
                </div>
                <div>
                  <dt className="mono-label">{t("admin.totalBrokers")}</dt>
                  <dd className="mt-1 font-display font-semibold text-3xl tracking-[-0.03em] text-forest-800">{stats.totalBrokers}</dd>
                </div>
              </dl>
            </div>

            <div className="card-elevated animate-fade-in-up opacity-0 stagger-1">
              <div className="mono-label mb-3">{t("admin.brokerVerificationSection")}</div>
              <dl className="grid grid-cols-3 gap-3">
                <div>
                  <dt className="mono-label">{t("admin.pendingVerifications")}</dt>
                  <dd className={`mt-1 font-display font-semibold text-3xl tracking-[-0.03em] ${stats.pendingVerifications > 0 ? "text-amber-600" : "text-forest-800"}`}>
                    {stats.pendingVerifications}
                  </dd>
                </div>
                <div>
                  <dt className="mono-label">{t("admin.verifiedBrokers")}</dt>
                  <dd className="mt-1 font-display font-semibold text-3xl tracking-[-0.03em] text-forest-700">{stats.verifiedBrokers}</dd>
                </div>
                <div>
                  <dt className="mono-label">{t("admin.rejectedBrokers")}</dt>
                  <dd className="mt-1 font-display font-semibold text-3xl tracking-[-0.03em] text-red-700">{stats.rejectedBrokers}</dd>
                </div>
              </dl>
            </div>

            <div className="card-elevated lg:col-span-2 animate-fade-in-up opacity-0 stagger-2">
              <div className="mono-label mb-3">{t("admin.requestPipeline")}</div>
              <dl className="grid grid-cols-4 sm:grid-cols-7 gap-3">
                <div className={`rounded-sm p-2.5 ${stats.requestsByStatus.pendingApproval > 0 ? "bg-amber-50 ring-1 ring-amber-200" : ""}`}>
                  <dt className="mono-label">{t("status.pendingApproval")}</dt>
                  <dd className={`mt-1 font-display font-semibold text-2xl tracking-[-0.03em] ${stats.requestsByStatus.pendingApproval > 0 ? "text-amber-600" : "text-forest-800"}`}>{stats.requestsByStatus.pendingApproval}</dd>
                </div>
                <div className="p-2.5">
                  <dt className="mono-label">{t("status.open")}</dt>
                  <dd className="mt-1 font-display font-semibold text-2xl tracking-[-0.03em] text-forest-800">{stats.requestsByStatus.open}</dd>
                </div>
                <div className="p-2.5">
                  <dt className="mono-label">{t("status.inProgress")}</dt>
                  <dd className="mt-1 font-display font-semibold text-2xl tracking-[-0.03em] text-forest-800">{stats.requestsByStatus.inProgress}</dd>
                </div>
                <div className="p-2.5">
                  <dt className="mono-label">{t("status.closed")}</dt>
                  <dd className="mt-1 font-display font-semibold text-2xl tracking-[-0.03em] text-sage-700">{stats.requestsByStatus.closed}</dd>
                </div>
                <div className="p-2.5">
                  <dt className="mono-label">{t("status.expired")}</dt>
                  <dd className="mt-1 font-display font-semibold text-2xl tracking-[-0.03em] text-sage-700">{stats.requestsByStatus.expired}</dd>
                </div>
                <div className="p-2.5">
                  <dt className="mono-label">{t("status.rejected")}</dt>
                  <dd className="mt-1 font-display font-semibold text-2xl tracking-[-0.03em] text-red-700">{stats.requestsByStatus.rejected}</dd>
                </div>
                <div className="p-2.5 border-l border-cream-300">
                  <dt className="mono-label">{t("admin.total")}</dt>
                  <dd className="mt-1 font-display font-semibold text-2xl tracking-[-0.03em] text-forest-800">{stats.requestsByStatus.total}</dd>
                </div>
              </dl>
            </div>

            <div className="card-elevated lg:col-span-2 animate-fade-in-up opacity-0 stagger-3">
              <div className="mono-label mb-3">{t("admin.activitySection")}</div>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <dt className="mono-label">{t("admin.activeConversations")}</dt>
                  <dd className="mt-1 font-display font-semibold text-3xl tracking-[-0.03em] text-forest-800">{stats.activeConversations}</dd>
                </div>
                <div>
                  <dt className="mono-label">{t("admin.totalConversationsLabel")}</dt>
                  <dd className="mt-1 font-display font-semibold text-3xl tracking-[-0.03em] text-forest-800">{stats.totalConversations}</dd>
                </div>
                <div>
                  <dt className="mono-label">{t("admin.openReports")}</dt>
                  <dd className={`mt-1 font-display font-semibold text-3xl tracking-[-0.03em] ${stats.openReports > 0 ? "text-red-700" : "text-forest-800"}`}>
                    {stats.openReports}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* 30-Day Trends */}
        {trends.length > 0 && (
          <div className="card-elevated mb-8 animate-fade-in-up opacity-0 stagger-6">
            <div className="mono-label mb-1">— {t("admin.thirtyDayTrends")}</div>
            <h2 className="heading-sm mt-2 mb-1">{t("admin.thirtyDayTrends")}</h2>
            <p className="text-body-sm mb-6">{t("admin.thirtyDayTrendsDesc")}</p>
            <TrendChart
              data={trends.map((d) => ({ ...d, label: d.date.slice(5) }))}
              locale={router.locale || "ko"}
              trends={trends}
              t={t}
            />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});
