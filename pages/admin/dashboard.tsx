import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import Layout from "@/components/Layout";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";

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
  totalIntroductions: number;
  openReports: number;
}

interface TrendDay {
  date: string;
  users: number;
  requests: number;
  conversations: number;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trends, setTrends] = useState<TrendDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/login", undefined, { locale: router.locale });
      return;
    }

    const fetchData = async () => {
      try {
        const [statsRes, trendsRes] = await Promise.all([
          fetch("/api/admin/stats"),
          fetch("/api/admin/trends"),
        ]);
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data);
        }
        if (trendsRes.ok) {
          setTrends(await trendsRes.json());
        }
      } catch {
        // Network error
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session, status, router]);

  if (status === "loading" || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">Loading dashboard...</p>
        </div>
      </Layout>
    );
  }

  if (!session || session.user.role !== "ADMIN") {
    return null;
  }

  const pendingApprovalCount = stats?.requestsByStatus.pendingApproval ?? 0;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Header ── */}
        <div className="mb-6 animate-fade-in">
          <h1 className="heading-lg">{t("admin.dashboard")}</h1>
        </div>

        {/* ── Quick Links (top) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {/* ─ Row 1: Action queues (need attention) ─ */}
          <Link
            href="/admin/requests?status=PENDING_APPROVAL"
            className="card group flex items-center gap-4 animate-fade-in-up opacity-0 stagger-1"
          >
            <span className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${pendingApprovalCount > 0 ? "bg-amber-100 text-amber-700 group-hover:bg-amber-200" : "bg-sage-100 text-sage-700 group-hover:bg-sage-200"}`}>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
              </svg>
            </span>
            <div className="flex items-center gap-2">
              <div>
                <p className="font-body text-sm font-semibold text-forest-800">{t("admin.mortgageConsultationQueue")}</p>
                <p className="text-body-sm">
                  {pendingApprovalCount} {t("status.pendingApproval")}
                </p>
              </div>
              {pendingApprovalCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold font-body animate-pulse">
                  {pendingApprovalCount}
                </span>
              )}
            </div>
          </Link>
          <Link
            href="/admin/verification"
            className="card group flex items-center gap-4 animate-fade-in-up opacity-0 stagger-1"
          >
            <span className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${(stats?.pendingVerifications ?? 0) > 0 ? "bg-amber-100 text-amber-700 group-hover:bg-amber-200" : "bg-sage-100 text-sage-700 group-hover:bg-sage-200"}`}>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </span>
            <div>
              <p className="font-body text-sm font-semibold text-forest-800">{t("admin.brokerVerificationQueue")}</p>
              <p className="text-body-sm">
                {stats?.pendingVerifications ?? 0} {t("status.pending").toLowerCase()}
              </p>
            </div>
          </Link>
          <Link
            href="/admin/reports"
            className="card group flex items-center gap-4 animate-fade-in-up opacity-0 stagger-1"
          >
            <span className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${(stats?.openReports ?? 0) > 0 ? "bg-rose-50 text-rose-700 group-hover:bg-rose-100" : "bg-sage-100 text-sage-700 group-hover:bg-sage-200"}`}>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
              </svg>
            </span>
            <div>
              <p className="font-body text-sm font-semibold text-forest-800">{t("admin.reports")}</p>
              <p className="text-body-sm">
                {stats?.openReports ?? 0} {t("status.open").toLowerCase()}
              </p>
            </div>
          </Link>

          {/* ─ Row 2: Core management ─ */}
          <Link
            href="/admin/requests"
            className="card group flex items-center gap-4 animate-fade-in-up opacity-0 stagger-2"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sage-100 text-sage-700 transition-colors group-hover:bg-sage-200">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </span>
            <div>
              <p className="font-body text-sm font-semibold text-forest-800">{t("admin.requestManagement", "Request Management")}</p>
              <p className="text-body-sm">
                {stats?.requestsByStatus.total ?? 0} {t("admin.totalUsersLabel", "total")}
              </p>
            </div>
          </Link>
          <Link
            href="/admin/users"
            className="card group flex items-center gap-4 animate-fade-in-up opacity-0 stagger-2"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest-100 text-forest-700 transition-colors group-hover:bg-forest-200">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </span>
            <div>
              <p className="font-body text-sm font-semibold text-forest-800">{t("admin.userManagement", "User Management")}</p>
              <p className="text-body-sm">
                {stats?.users ?? 0} {t("admin.totalUsersLabel", "total")}
              </p>
            </div>
          </Link>
          <Link
            href="/admin/brokers"
            className="card group flex items-center gap-4 animate-fade-in-up opacity-0 stagger-2"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sage-100 text-sage-700 transition-colors group-hover:bg-sage-200">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
            </span>
            <div>
              <p className="font-body text-sm font-semibold text-forest-800">{t("admin.brokerManagement")}</p>
              <p className="text-body-sm">{t("admin.manageBrokers", "Manage brokers")}</p>
            </div>
          </Link>
          <Link
            href="/admin/conversations"
            className="card group flex items-center gap-4 animate-fade-in-up opacity-0 stagger-3"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest-100 text-forest-700 transition-colors group-hover:bg-forest-200">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
              </svg>
            </span>
            <div>
              <p className="font-body text-sm font-semibold text-forest-800">{t("admin.conversationOversight", "Conversations")}</p>
              <p className="text-body-sm">
                {stats?.activeConversations ?? 0} {t("status.active").toLowerCase()}
              </p>
            </div>
          </Link>

          {/* ─ Row 3: Utilities ─ */}
          <Link
            href="/admin/activity"
            className="card group flex items-center gap-4 animate-fade-in-up opacity-0 stagger-3"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cream-200 text-forest-700 transition-colors group-hover:bg-cream-300">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </span>
            <div>
              <p className="font-body text-sm font-semibold text-forest-800">{t("admin.activityLog", "Activity Log")}</p>
              <p className="text-body-sm">{t("admin.recentActions", "Recent actions")}</p>
            </div>
          </Link>
          <Link
            href="/admin/settings"
            className="card group flex items-center gap-4 animate-fade-in-up opacity-0 stagger-4"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sage-100 text-sage-700 transition-colors group-hover:bg-sage-200">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </span>
            <div>
              <p className="font-body text-sm font-semibold text-forest-800">{t("admin.systemSettings", "System Settings")}</p>
              <p className="text-body-sm">{t("admin.systemSettingsShort", "Platform config")}</p>
            </div>
          </Link>
          <Link
            href="/admin/manual"
            className="card group flex items-center gap-4 animate-fade-in-up opacity-0 stagger-4"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest-50 text-forest-700 transition-colors group-hover:bg-forest-100">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
            </span>
            <div>
              <p className="font-body text-sm font-semibold text-forest-800">{t("admin.manual", "Admin Manual")}</p>
              <p className="text-body-sm">{t("admin.manualDesc", "Portal usage guide")}</p>
            </div>
          </Link>
        </div>

        {/* ── Section 3: Stats Overview ── */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            {/* Users + Brokers */}
            <div className="card-elevated animate-fade-in-up opacity-0 stagger-3">
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

            {/* Broker Verification */}
            <div className="card-elevated animate-fade-in-up opacity-0 stagger-3">
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

            {/* Request Pipeline — full width */}
            <div className="card-elevated lg:col-span-2 animate-fade-in-up opacity-0 stagger-4">
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
                  <dt className="font-body text-[11px] text-forest-700/60 font-semibold">{t("admin.totalUsersLabel", "Total")}</dt>
                  <dd className="font-display text-2xl text-forest-800">{stats.requestsByStatus.total}</dd>
                </div>
              </dl>
            </div>

            {/* Activity */}
            <div className="card-elevated lg:col-span-2 animate-fade-in-up opacity-0 stagger-5">
              <h3 className="font-body text-xs font-semibold uppercase tracking-wider text-forest-700/50 mb-3">{t("admin.activitySection")}</h3>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <dt className="font-body text-[11px] text-forest-700/60">{t("admin.activeConversations", "Active Conversations")}</dt>
                  <dd className="font-display text-xl text-forest-800">{stats.activeConversations}</dd>
                </div>
                <div>
                  <dt className="font-body text-[11px] text-forest-700/60">{t("admin.totalConversationsLabel")}</dt>
                  <dd className="font-display text-xl text-forest-800">{stats.totalConversations}</dd>
                </div>
                <div>
                  <dt className="font-body text-[11px] text-forest-700/60">{t("admin.totalIntroductions")}</dt>
                  <dd className="font-display text-xl text-forest-800">{stats.totalIntroductions}</dd>
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

        {/* ── Section 4: 30-Day Trends ── */}
        {trends.length > 0 && (
          <div className="card-elevated mb-8 animate-fade-in-up stagger-6">
            <h2 className="heading-sm mb-1">{t("admin.trends", "30-Day Trends")}</h2>
            <p className="text-body-sm mb-6">{t("admin.trendsDesc", "Daily new users, requests, and conversations.")}</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={trends.map((d) => ({
                  ...d,
                  label: d.date.slice(5), // MM-DD
                }))}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f3528",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 12,
                    fontFamily: "Outfit, sans-serif",
                    color: "#f5f0e8",
                    padding: "10px 16px",
                    boxShadow: "0 8px 24px rgba(31,53,40,0.25)",
                  }}
                  itemStyle={{ color: "#e8e4dc", padding: "3px 0" }}
                  labelStyle={{ color: "#b8c4ae", fontWeight: 600, marginBottom: 6, fontSize: 11 }}
                  labelFormatter={(label) => {
                    const match = trends.find((d) => d.date.slice(5) === label);
                    if (!match) return label;
                    return new Date(match.date + "T12:00:00").toLocaleDateString(
                      router.locale === "ko" ? "ko-KR" : "en-CA",
                      { weekday: "short", month: "short", day: "numeric" }
                    );
                  }}
                  cursor={{ fill: "rgba(0,0,0,0.04)", radius: 4 }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, fontFamily: "Outfit, sans-serif", paddingTop: 12, color: "#64748b" }}
                />
                <Bar
                  dataKey="users"
                  name={t("admin.trendUsers", "Users")}
                  fill="#3d6b4f"
                  radius={[0, 0, 0, 0]}
                  stackId="a"
                />
                <Bar
                  dataKey="requests"
                  name={t("admin.trendRequests", "Requests")}
                  fill="#8faa7e"
                  stackId="a"
                />
                <Bar
                  dataKey="conversations"
                  name={t("admin.trendConversations", "Conversations")}
                  fill="#c8a86e"
                  radius={[3, 3, 0, 0]}
                  stackId="a"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale ?? "ko", ["common"])),
    },
  };
};
