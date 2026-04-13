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

interface RecentAction {
  id: string;
  action: string;
  targetType: string;
  adminName: string;
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
  const [recentActions, setRecentActions] = useState<RecentAction[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const hasFetched = useRef(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") return;
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchData = async () => {
      try {
        const [statsResult, trendsResult, brokersResult, requestsResult, reportsResult, actionsResult] = await Promise.allSettled([
          fetch("/api/admin/stats"),
          fetch("/api/admin/trends"),
          fetch("/api/admin/brokers?status=PENDING&limit=5"),
          fetch("/api/admin/requests?status=PENDING_APPROVAL&limit=5"),
          fetch("/api/admin/reports?status=OPEN&limit=5"),
          fetch("/api/admin/actions?limit=10"),
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

        if (actionsResult.status === "fulfilled" && actionsResult.value.ok) {
          const json = await actionsResult.value.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setRecentActions((json.data || []).slice(0, 10).map((a: any) => ({
            id: a.id,
            action: a.action,
            targetType: a.targetType,
            adminName: a.admin?.name ?? a.admin?.email ?? "Admin",
            createdAt: a.createdAt?.slice(0, 10) ?? "",
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

  return (
    <AdminLayout>
      <Head><title>{t("titles.adminDashboard")}</title></Head>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 animate-fade-in">
          <h1 className="heading-lg">{t("admin.dashboard")}</h1>
          <p className="text-body-sm mt-1">{t("admin.dashboardDescription", "Overview of platform activity and key metrics.")}</p>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            <div className="card-elevated animate-fade-in-up opacity-0 stagger-1">
              <h3 className="font-body text-xs font-semibold uppercase tracking-wider text-forest-700/50 mb-3">{t("admin.usersSection")}</h3>
              <dl className="grid grid-cols-3 gap-3">
                <div>
                  <dt className="font-body text-[11px] text-forest-700/60">{t("admin.totalUsers")}</dt>
                  <dd className="font-display text-xl text-forest-800">{stats.users}</dd>
                </div>
                <div>
                  <dt className="font-body text-[11px] text-forest-700/60">{t("admin.totalBorrowers")}</dt>
                  <dd className="font-display text-xl text-forest-800">{stats.totalBorrowers}</dd>
                </div>
                <div>
                  <dt className="font-body text-[11px] text-forest-700/60">{t("admin.totalBrokers")}</dt>
                  <dd className="font-display text-xl text-forest-800">{stats.totalBrokers}</dd>
                </div>
              </dl>
            </div>

            <div className="card-elevated animate-fade-in-up opacity-0 stagger-1">
              <h3 className="font-body text-xs font-semibold uppercase tracking-wider text-forest-700/50 mb-3">{t("admin.brokerVerificationSection")}</h3>
              <dl className="grid grid-cols-3 gap-3">
                <div>
                  <dt className="font-body text-[11px] text-forest-700/60">{t("admin.pendingVerifications")}</dt>
                  <dd className={`font-display text-xl ${stats.pendingVerifications > 0 ? "text-amber-700" : "text-forest-800"}`}>
                    {stats.pendingVerifications}
                  </dd>
                </div>
                <div>
                  <dt className="font-body text-[11px] text-forest-700/60">{t("admin.verifiedBrokers")}</dt>
                  <dd className="font-display text-xl text-forest-700">{stats.verifiedBrokers}</dd>
                </div>
                <div>
                  <dt className="font-body text-[11px] text-forest-700/60">{t("admin.rejectedBrokers")}</dt>
                  <dd className="font-display text-xl text-rose-700">{stats.rejectedBrokers}</dd>
                </div>
              </dl>
            </div>

            <div className="card-elevated lg:col-span-2 animate-fade-in-up opacity-0 stagger-2">
              <h3 className="font-body text-xs font-semibold uppercase tracking-wider text-forest-700/50 mb-3">{t("admin.requestPipeline")}</h3>
              <dl className="grid grid-cols-4 sm:grid-cols-7 gap-3">
                <div className={`rounded-lg p-2.5 ${stats.requestsByStatus.pendingApproval > 0 ? "bg-amber-50 ring-1 ring-amber-200" : ""}`}>
                  <dt className="font-body text-[11px] text-amber-800/70 font-medium">{t("status.pendingApproval")}</dt>
                  <dd className="font-display text-2xl text-amber-700">{stats.requestsByStatus.pendingApproval}</dd>
                </div>
                <div className="p-2.5">
                  <dt className="font-body text-[11px] text-forest-700/60">{t("status.open")}</dt>
                  <dd className="font-display text-2xl text-forest-800">{stats.requestsByStatus.open}</dd>
                </div>
                <div className="p-2.5">
                  <dt className="font-body text-[11px] text-forest-700/60">{t("status.inProgress")}</dt>
                  <dd className="font-display text-2xl text-forest-800">{stats.requestsByStatus.inProgress}</dd>
                </div>
                <div className="p-2.5">
                  <dt className="font-body text-[11px] text-forest-700/60">{t("status.closed")}</dt>
                  <dd className="font-display text-2xl text-sage-700">{stats.requestsByStatus.closed}</dd>
                </div>
                <div className="p-2.5">
                  <dt className="font-body text-[11px] text-forest-700/60">{t("status.expired")}</dt>
                  <dd className="font-display text-2xl text-sage-700">{stats.requestsByStatus.expired}</dd>
                </div>
                <div className="p-2.5">
                  <dt className="font-body text-[11px] text-forest-700/60">{t("status.rejected")}</dt>
                  <dd className="font-display text-2xl text-rose-700">{stats.requestsByStatus.rejected}</dd>
                </div>
                <div className="p-2.5 border-l border-cream-200">
                  <dt className="font-body text-[11px] text-forest-700/60 font-semibold">{t("admin.total")}</dt>
                  <dd className="font-display text-2xl text-forest-800">{stats.requestsByStatus.total}</dd>
                </div>
              </dl>
            </div>

            <div className="card-elevated lg:col-span-2 animate-fade-in-up opacity-0 stagger-3">
              <h3 className="font-body text-xs font-semibold uppercase tracking-wider text-forest-700/50 mb-3">{t("admin.activitySection")}</h3>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <dt className="font-body text-[11px] text-forest-700/60">{t("admin.activeConversations")}</dt>
                  <dd className="font-display text-xl text-forest-800">{stats.activeConversations}</dd>
                </div>
                <div>
                  <dt className="font-body text-[11px] text-forest-700/60">{t("admin.totalConversationsLabel")}</dt>
                  <dd className="font-display text-xl text-forest-800">{stats.totalConversations}</dd>
                </div>
                <div>
                  <dt className="font-body text-[11px] text-forest-700/60">{t("admin.openReports")}</dt>
                  <dd className={`font-display text-xl ${stats.openReports > 0 ? "text-rose-700" : "text-forest-800"}`}>
                    {stats.openReports}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* Urgent Queues */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {/* Pending Broker Verifications */}
          <div className="card-elevated animate-fade-in-up opacity-0 stagger-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-body text-sm font-semibold text-forest-800">{t("admin.queue.pendingVerifications", "Pending Verifications")}</h3>
              <Link
                href="/admin/brokers?status=PENDING"
                className="font-body text-xs font-medium text-forest-600 hover:text-forest-800 transition-colors"
              >
                {t("admin.queue.viewAll", "View All")} &rarr;
              </Link>
            </div>
            {pendingBrokers.length === 0 ? (
              <p className="text-body-sm py-4 text-center">{t("admin.queue.noPendingBrokers", "No pending verifications")}</p>
            ) : (
              <ul className="divide-y divide-cream-200">
                {pendingBrokers.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm font-medium text-forest-800 truncate">{b.userName}</p>
                      <p className="font-body text-xs text-forest-700/50 truncate">{b.brokerageName} &middot; {b.province}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleVerifyBroker(b.id, "VERIFIED")}
                        disabled={actionLoading === b.id}
                        className="rounded-md bg-forest-700 px-2.5 py-1 font-body text-[11px] font-semibold text-white transition-all hover:bg-forest-800 active:scale-95 disabled:opacity-50"
                      >
                        {actionLoading === b.id ? "..." : t("admin.approve")}
                      </button>
                      <button
                        onClick={() => handleVerifyBroker(b.id, "REJECTED")}
                        disabled={actionLoading === b.id}
                        className="rounded-md bg-rose-600 px-2.5 py-1 font-body text-[11px] font-semibold text-white transition-all hover:bg-rose-700 active:scale-95 disabled:opacity-50"
                      >
                        {actionLoading === b.id ? "..." : t("admin.reject")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Pending Request Approvals */}
          <div className="card-elevated animate-fade-in-up opacity-0 stagger-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-body text-sm font-semibold text-forest-800">{t("admin.queue.pendingApprovals", "Pending Approvals")}</h3>
              <Link
                href="/admin/requests?status=PENDING_APPROVAL"
                className="font-body text-xs font-medium text-forest-600 hover:text-forest-800 transition-colors"
              >
                {t("admin.queue.viewAll", "View All")} &rarr;
              </Link>
            </div>
            {pendingRequests.length === 0 ? (
              <p className="text-body-sm py-4 text-center">{t("admin.queue.noPendingRequests", "No pending requests")}</p>
            ) : (
              <ul className="divide-y divide-cream-200">
                {pendingRequests.map((r) => (
                  <li key={r.publicId} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm font-medium text-forest-800 truncate">{r.borrowerName}</p>
                      <p className="font-body text-xs text-forest-700/50 truncate">{r.province} &middot; #{r.publicId}</p>
                    </div>
                    <button
                      onClick={() => handleApproveRequest(r.id)}
                      disabled={actionLoading === r.id}
                      className="shrink-0 rounded-md bg-forest-700 px-2.5 py-1 font-body text-[11px] font-semibold text-white transition-all hover:bg-forest-800 active:scale-95 disabled:opacity-50"
                    >
                      {actionLoading === r.id ? "..." : t("admin.approve")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Open Reports */}
          <div className="card-elevated animate-fade-in-up opacity-0 stagger-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-body text-sm font-semibold text-forest-800">{t("admin.queue.openReports", "Open Reports")}</h3>
              <Link
                href="/admin/reports?status=OPEN"
                className="font-body text-xs font-medium text-forest-600 hover:text-forest-800 transition-colors"
              >
                {t("admin.queue.viewAll", "View All")} &rarr;
              </Link>
            </div>
            {openReports.length === 0 ? (
              <p className="text-body-sm py-4 text-center">{t("admin.queue.noOpenReports", "No open reports")}</p>
            ) : (
              <ul className="divide-y divide-cream-200">
                {openReports.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="font-body text-sm font-medium text-forest-800 truncate">{r.reason}</p>
                      <p className="font-body text-xs text-forest-700/50 truncate">{r.targetType} &middot; {t("admin.by")} {r.reporterName}</p>
                    </div>
                    <span className="font-body text-[11px] text-forest-700/40 shrink-0 ml-3">{formatDate(r.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent Activity */}
          <div className="card-elevated animate-fade-in-up opacity-0 stagger-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-body text-sm font-semibold text-forest-800">{t("admin.queue.recentActivity", "Recent Activity")}</h3>
              <Link
                href="/admin/activity"
                className="font-body text-xs font-medium text-forest-600 hover:text-forest-800 transition-colors"
              >
                {t("admin.queue.viewAll", "View All")} &rarr;
              </Link>
            </div>
            {recentActions.length === 0 ? (
              <p className="text-body-sm py-4 text-center">{t("admin.queue.noRecentActivity", "No recent activity")}</p>
            ) : (
              <ul className="divide-y divide-cream-200">
                {recentActions.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="font-body text-sm font-medium text-forest-800 truncate">
                        {a.action.replace(/_/g, " ")}
                      </p>
                      <p className="font-body text-xs text-forest-700/50 truncate">{a.targetType} &middot; {a.adminName}</p>
                    </div>
                    <span className="font-body text-[11px] text-forest-700/40 shrink-0 ml-3">{formatDate(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 30-Day Trends */}
        {trends.length > 0 && (
          <div className="card-elevated mb-8 animate-fade-in-up opacity-0 stagger-6">
            <h2 className="heading-sm mb-1">{t("admin.thirtyDayTrends")}</h2>
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
