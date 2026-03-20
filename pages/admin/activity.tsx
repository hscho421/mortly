import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import Layout from "@/components/Layout";
import Pagination from "@/components/Pagination";
import { downloadCSV } from "@/lib/csvExport";

interface AdminActionRow {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string | null;
  reason: string | null;
  createdAt: string;
  admin: {
    id: string;
    name: string | null;
    email: string;
  };
}

const ACTION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  CREDIT_ADJUST: {
    label: "Credit Adjustment",
    color: "bg-amber-100 text-amber-800",
    icon: "M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  },
  SUSPEND_USER: {
    label: "User Suspended",
    color: "bg-amber-100 text-amber-800",
    icon: "M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636",
  },
  BAN_USER: {
    label: "User Banned",
    color: "bg-rose-100 text-rose-700",
    icon: "M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636",
  },
  REACTIVATE_USER: {
    label: "User Reactivated",
    color: "bg-forest-100 text-forest-700",
    icon: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  },
  VERIFY_BROKER: {
    label: "Broker Verified",
    color: "bg-forest-100 text-forest-700",
    icon: "M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z",
  },
  REJECT_BROKER: {
    label: "Broker Rejected",
    color: "bg-rose-100 text-rose-700",
    icon: "M6 18 18 6M6 6l12 12",
  },
  CLOSE_REQUEST: {
    label: "Request Closed",
    color: "bg-sage-200 text-sage-700",
    icon: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  },
  REOPEN_REQUEST: {
    label: "Request Reopened",
    color: "bg-forest-100 text-forest-700",
    icon: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  },
  UPDATE_REQUEST_STATUS: {
    label: "Request Status Updated",
    color: "bg-amber-100 text-amber-800",
    icon: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  },
  DELETE_REQUEST: {
    label: "Request Deleted",
    color: "bg-rose-100 text-rose-700",
    icon: "m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0",
  },
  CLOSE_CONVERSATION: {
    label: "Conversation Closed",
    color: "bg-rose-100 text-rose-700",
    icon: "M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155",
  },
  RESOLVE_REPORT: {
    label: "Report Resolved",
    color: "bg-forest-100 text-forest-700",
    icon: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  },
  DISMISS_REPORT: {
    label: "Report Dismissed",
    color: "bg-sage-200 text-sage-700",
    icon: "M6 18 18 6M6 6l12 12",
  },
  UPDATE_REPORT: {
    label: "Report Updated",
    color: "bg-amber-100 text-amber-800",
    icon: "M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5",
  },
};

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseDetails(details: string | null): Record<string, unknown> | null {
  if (!details) return null;
  try {
    return JSON.parse(details);
  } catch {
    return null;
  }
}

function ActionDetails({ action, details }: { action: string; details: string | null }) {
  const parsed = parseDetails(details);
  if (!parsed) return null;

  if (action === "CREDIT_ADJUST") {
    const amount = parsed.amount as number;
    return (
      <span className="font-body text-xs text-forest-700/70">
        {amount > 0 ? "+" : ""}{amount} credits ({String(parsed.previousBalance)} → {String(parsed.newBalance)})
      </span>
    );
  }

  if (action.includes("USER") || action === "VERIFY_BROKER" || action === "REJECT_BROKER") {
    return (
      <span className="font-body text-xs text-forest-700/70">
        {String(parsed.previousStatus)} → {String(parsed.newStatus)}
      </span>
    );
  }

  if (action.includes("REQUEST")) {
    if (parsed.previousStatus && parsed.newStatus) {
      return (
        <span className="font-body text-xs text-forest-700/70">
          {String(parsed.previousStatus)} → {String(parsed.newStatus)}
        </span>
      );
    }
    if (parsed.requestType) {
      return (
        <span className="font-body text-xs text-forest-700/70">
          {String(parsed.requestType)} · {String(parsed.province)}
        </span>
      );
    }
  }

  if (action === "CLOSE_CONVERSATION") {
    return (
      <span className="font-body text-xs text-forest-700/70">
        Conversation closed by admin
      </span>
    );
  }

  if (action.includes("REPORT")) {
    if (parsed.previousStatus && parsed.newStatus) {
      return (
        <span className="font-body text-xs text-forest-700/70">
          {String(parsed.previousStatus)} → {String(parsed.newStatus)} ({String(parsed.reportTargetType)})
        </span>
      );
    }
  }

  return null;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminActivity() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");
  const [actions, setActions] = useState<AdminActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const fetchActions = useCallback(async (currentPage: number, currentFilter: string) => {
    setLoading(true);
    try {
      const actionParam = currentFilter !== "ALL" ? `&action=${currentFilter}` : "";
      const res = await fetch(`/api/admin/actions?page=${currentPage}&limit=20${actionParam}`);
      if (res.ok) {
        const json = await res.json();
        setActions(json.data);
        setPagination(json.pagination);
      }
    } catch {
      // Network error
    } finally {
      setLoading(false);
    }
  }, []);

  // Auth guard + initial fetch
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/login", undefined, { locale: router.locale });
      return;
    }
    fetchActions(page, filterAction);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, router]);

  // Reset page to 1 when filter changes
  useEffect(() => {
    if (status !== "authenticated") return;
    setPage(1);
    fetchActions(1, filterAction);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAction]);

  if (status === "loading" || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">{t("admin.loadingActivity", "Loading activity...")}</p>
        </div>
      </Layout>
    );
  }

  if (!session || session.user.role !== "ADMIN") {
    return null;
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <Link
            href="/admin/dashboard"
            className="mb-4 inline-flex items-center gap-1 font-body text-sm font-medium text-forest-600 hover:text-forest-800 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            {t("admin.backToDashboard", "Back to Dashboard")}
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="heading-lg">{t("admin.activityLog", "Activity Log")}</h1>
            <button
              onClick={async () => {
                try {
                  const actionParam = filterAction !== "ALL" ? `&action=${filterAction}` : "";
                  const res = await fetch(`/api/admin/actions?limit=10000${actionParam}`);
                  if (!res.ok) return;
                  const json = await res.json();
                  const allData: AdminActionRow[] = json.data ?? json;
                  const headers = ["Date", "Action", "Admin", "Target Type", "Target ID", "Reason", "Details"];
                  const rows = allData.map((a) => [
                    new Date(a.createdAt).toISOString().slice(0, 19).replace("T", " "),
                    a.action,
                    a.admin.name || a.admin.email,
                    a.targetType,
                    a.targetId,
                    a.reason || "",
                    a.details || "",
                  ]);
                  downloadCSV("activity_export", headers, rows);
                } catch {
                  // Network error
                }
              }}
              className="btn-secondary !rounded-lg"
            >
              {t("admin.exportCsv", "Export CSV")}
            </button>
          </div>
          <p className="text-body mt-2">
            {t("admin.activityLogDesc", "History of all admin actions taken on the platform.")}
          </p>
        </div>

        {/* Filter */}
        <div className="card-elevated mb-8 animate-fade-in-up stagger-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label htmlFor="actionFilter" className="label-text !mb-0">
              {t("admin.filterByAction", "Filter by action")}
            </label>
            <select
              id="actionFilter"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="input-field w-auto min-w-[200px]"
            >
              <option value="ALL">{t("admin.allActions", "All Actions")}</option>
              <option value="CREDIT_ADJUST">{t("admin.creditAdjustments", "Credit Adjustments")}</option>
              <option value="SUSPEND_USER">{t("admin.suspensions", "Suspensions")}</option>
              <option value="BAN_USER">{t("admin.bans", "Bans")}</option>
              <option value="REACTIVATE_USER">{t("admin.reactivations", "Reactivations")}</option>
              <option value="VERIFY_BROKER">{t("admin.verifications", "Verifications")}</option>
              <option value="REJECT_BROKER">{t("admin.rejections", "Rejections")}</option>
              <option value="CLOSE_REQUEST">{t("admin.requestClosures", "Request Closures")}</option>
              <option value="DELETE_REQUEST">{t("admin.requestDeletions", "Request Deletions")}</option>
              <option value="CLOSE_CONVERSATION">{t("admin.conversationClosures", "Conversation Closures")}</option>
              <option value="RESOLVE_REPORT">{t("admin.reportResolutions", "Report Resolutions")}</option>
              <option value="DISMISS_REPORT">{t("admin.reportDismissals", "Report Dismissals")}</option>
            </select>
          </div>
        </div>

        {/* Activity List */}
        <div className="space-y-3 animate-fade-in-up stagger-2">
          {actions.length === 0 ? (
            <div className="card-elevated py-16 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cream-200">
                <svg className="h-6 w-6 text-sage-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <p className="font-body text-sm font-medium text-forest-700">
                {t("admin.noActivity", "No activity recorded yet.")}
              </p>
            </div>
          ) : (
            actions.map((entry) => {
              const meta = ACTION_LABELS[entry.action] || {
                label: entry.action,
                color: "bg-sage-100 text-sage-700",
                icon: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
              };

              return (
                <div key={entry.id} className="card flex items-start gap-4 px-5 py-4">
                  {/* Icon */}
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d={meta.icon} />
                    </svg>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 font-body text-[11px] font-semibold ${meta.color}`}>
                        {meta.label}
                      </span>
                      <ActionDetails action={entry.action} details={entry.details} />
                    </div>

                    {entry.reason && (
                      <p className="mt-1.5 font-body text-sm text-forest-700/80">
                        &ldquo;{entry.reason}&rdquo;
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-body text-xs text-forest-700/50">
                        {t("admin.by", "By")} {entry.admin.name || entry.admin.email}
                      </span>
                      <span className="font-body text-xs text-forest-700/50">
                        {t("admin.target", "Target")}: {entry.targetType.toLowerCase()} {entry.targetId.slice(0, 12)}...
                      </span>
                      <span className="font-body text-xs text-forest-700/40">
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={(newPage) => {
            setPage(newPage);
            fetchActions(newPage, filterAction);
          }}
        />
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});
