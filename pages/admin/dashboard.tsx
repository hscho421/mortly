import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import Layout from "@/components/Layout";

interface DashboardStats {
  totalUsers: number;
  pendingVerifications: number;
  activeRequests: number;
  openReports: number;
}

interface ActivityItem {
  id: string;
  type: "user_signup" | "verification" | "request" | "report";
  message: string;
  timestamp: string;
}

const MOCK_STATS: DashboardStats = {
  totalUsers: 1248,
  pendingVerifications: 17,
  activeRequests: 342,
  openReports: 5,
};

const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: "1",
    type: "user_signup",
    message: "New broker registered: Sarah Chen from Pacific Mortgage Group",
    timestamp: "2 minutes ago",
  },
  {
    id: "2",
    type: "verification",
    message: "Broker verification approved: James Wilson (License #BC-29184)",
    timestamp: "15 minutes ago",
  },
  {
    id: "3",
    type: "request",
    message: "New mortgage request created in Toronto, ON - Purchase, $650K-$800K",
    timestamp: "32 minutes ago",
  },
  {
    id: "4",
    type: "report",
    message: "New report filed against broker profile (ID: clx8k2m0f)",
    timestamp: "1 hour ago",
  },
  {
    id: "5",
    type: "user_signup",
    message: "New borrower registered: anonymous user in Vancouver, BC",
    timestamp: "1 hour ago",
  },
  {
    id: "6",
    type: "verification",
    message: "Broker verification submitted: Maria Gonzalez (License #ON-44821)",
    timestamp: "2 hours ago",
  },
  {
    id: "7",
    type: "request",
    message: "Mortgage request closed - matched with broker in Calgary, AB",
    timestamp: "3 hours ago",
  },
  {
    id: "8",
    type: "report",
    message: "Report resolved: inappropriate message content dismissed",
    timestamp: "4 hours ago",
  },
];

const ACTIVITY_COLORS: Record<ActivityItem["type"], string> = {
  user_signup: "bg-forest-100 text-forest-700 ring-1 ring-inset ring-forest-600/20",
  verification: "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-600/20",
  request: "bg-sage-100 text-sage-700 ring-1 ring-inset ring-sage-600/20",
  report: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20",
};

const ACTIVITY_LABELS: Record<ActivityItem["type"], string> = {
  user_signup: "Signup",
  verification: "Verification",
  request: "Request",
  report: "Report",
};

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/login");
      return;
    }

    // Simulate API fetch
    const timer = setTimeout(() => {
      setStats(MOCK_STATS);
      setActivity(MOCK_ACTIVITY);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
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

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Page Header */}
        <div className="mb-10 animate-fade-in">
          <h1 className="heading-lg">{t("admin.dashboard")}</h1>
          <p className="text-body mt-2">
            {t("admin.dashboardDescription", "Overview of platform activity and key metrics.")}
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="card-elevated animate-fade-in-up opacity-0 stagger-1">
              <div className="flex items-center gap-3 mb-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-100 text-forest-700">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                  </svg>
                </span>
                <p className="text-body-sm font-medium">{t("admin.totalUsers")}</p>
              </div>
              <p className="font-display text-3xl text-forest-800">
                {stats.totalUsers.toLocaleString()}
              </p>
            </div>

            <div className="card-elevated animate-fade-in-up opacity-0 stagger-2">
              <div className="flex items-center gap-3 mb-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </span>
                <p className="text-body-sm font-medium">{t("admin.pendingVerifications")}</p>
              </div>
              <p className="font-display text-3xl text-amber-700">
                {stats.pendingVerifications}
              </p>
            </div>

            <div className="card-elevated animate-fade-in-up opacity-0 stagger-3">
              <div className="flex items-center gap-3 mb-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-100 text-sage-700">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </span>
                <p className="text-body-sm font-medium">{t("admin.activeRequests")}</p>
              </div>
              <p className="font-display text-3xl text-sage-700">
                {stats.activeRequests}
              </p>
            </div>

            <div className="card-elevated animate-fade-in-up opacity-0 stagger-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
                  </svg>
                </span>
                <p className="text-body-sm font-medium">{t("admin.openReports")}</p>
              </div>
              <p className="font-display text-3xl text-rose-700">
                {stats.openReports}
              </p>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12">
          <Link
            href="/admin/verification"
            className="card group flex items-center gap-4 animate-fade-in-up opacity-0 stagger-2"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700 transition-colors group-hover:bg-amber-200">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </span>
            <div>
              <p className="font-body text-sm font-semibold text-forest-800">{t("admin.verificationQueue")}</p>
              <p className="text-body-sm">
                {stats?.pendingVerifications ?? 0} {t("status.pending").toLowerCase()}
              </p>
            </div>
          </Link>
          <Link
            href="/admin/brokers"
            className="card group flex items-center gap-4 animate-fade-in-up opacity-0 stagger-3"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest-100 text-forest-700 transition-colors group-hover:bg-forest-200">
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
            href="/admin/reports"
            className="card group flex items-center gap-4 animate-fade-in-up opacity-0 stagger-4"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-700 transition-colors group-hover:bg-rose-100">
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
        </div>

        {/* Recent Activity Feed */}
        <div className="card-elevated animate-fade-in-up opacity-0 stagger-5">
          <div className="border-b border-cream-200 pb-5 mb-2">
            <h2 className="heading-sm">{t("admin.recentActivity", "Recent Activity")}</h2>
          </div>
          <ul className="divide-y divide-cream-200">
            {activity.map((item) => (
              <li key={item.id} className="flex items-start gap-4 py-4">
                <span
                  className={`mt-0.5 inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide ${ACTIVITY_COLORS[item.type]}`}
                >
                  {ACTIVITY_LABELS[item.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm text-forest-800">{item.message}</p>
                  <p className="mt-0.5 text-body-sm">
                    {item.timestamp}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale ?? "en", ["common"])),
    },
  };
};
