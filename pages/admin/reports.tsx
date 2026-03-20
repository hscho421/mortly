import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import Layout from "@/components/Layout";

type ReportStatus = "OPEN" | "REVIEWED" | "RESOLVED" | "DISMISSED";

interface ReportRow {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: ReportStatus;
  adminNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  reporter: {
    id: string;
    name: string | null;
    email: string;
  };
}

const STATUS_BADGE: Record<string, string> = {
  OPEN: "bg-rose-100 text-rose-700",
  REVIEWED: "bg-amber-100 text-amber-800",
  RESOLVED: "bg-forest-100 text-forest-700",
  DISMISSED: "bg-sage-200 text-sage-700",
};

const TARGET_BADGE: Record<string, string> = {
  BROKER: "bg-forest-100 text-forest-700 ring-1 ring-inset ring-forest-600/20",
  REQUEST: "bg-sage-100 text-sage-700 ring-1 ring-inset ring-sage-600/20",
  CONVERSATION: "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-600/20",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getTargetLink(targetType: string, targetId: string): string | null {
  switch (targetType) {
    case "BROKER":
      return `/admin/brokers`;
    case "REQUEST":
      return `/admin/requests`;
    case "CONVERSATION":
      return `/admin/conversations/${targetId}`;
    default:
      return null;
  }
}

export default function AdminReports() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");
  const [allReports, setAllReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ReportStatus | "ALL">("ALL");
  const [filterTarget, setFilterTarget] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Notes modal
  const [notesModal, setNotesModal] = useState<{ id: string; currentNotes: string | null; currentStatus: ReportStatus } | null>(null);
  const [notesText, setNotesText] = useState("");
  const [notesNewStatus, setNotesNewStatus] = useState<ReportStatus | "">("");
  const [notesSubmitting, setNotesSubmitting] = useState(false);
  const [notesMessage, setNotesMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/login", undefined, { locale: router.locale });
      return;
    }

    const fetchReports = async () => {
      try {
        const res = await fetch("/api/admin/reports");
        if (res.ok) {
          setAllReports(await res.json());
        }
      } catch {
        // Network error
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [session, status, router]);

  const reports = useMemo(() => {
    let filtered = allReports;

    if (filterStatus !== "ALL") {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }

    if (filterTarget !== "ALL") {
      filtered = filtered.filter((r) => r.targetType === filterTarget);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          (r.reporter.name || "").toLowerCase().includes(q) ||
          r.reporter.email.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q) ||
          r.targetId.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [allReports, filterStatus, filterTarget, searchQuery]);

  const handleStatusChange = async (reportId: string, newStatus: ReportStatus) => {
    setActionLoading(reportId);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        const updated = await res.json();
        setAllReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: updated.status, resolvedAt: updated.resolvedAt } : r))
        );
      }
    } catch {
      // error
    } finally {
      setActionLoading(null);
    }
  };

  const handleNotesSave = async () => {
    if (!notesModal) return;
    setNotesSubmitting(true);
    setNotesMessage(null);

    try {
      const body: Record<string, string> = { adminNotes: notesText };
      if (notesNewStatus) body.status = notesNewStatus;

      const res = await fetch(`/api/admin/reports/${notesModal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const updated = await res.json();
        setAllReports((prev) =>
          prev.map((r) =>
            r.id === notesModal.id
              ? { ...r, adminNotes: updated.adminNotes, status: updated.status, resolvedAt: updated.resolvedAt }
              : r
          )
        );
        setNotesMessage({ text: t("admin.notesSaved", "Notes saved successfully"), ok: true });
        setTimeout(() => {
          setNotesModal(null);
          setNotesMessage(null);
        }, 1200);
      } else {
        const data = await res.json();
        setNotesMessage({ text: data.error, ok: false });
      }
    } catch {
      setNotesMessage({ text: "Failed to save", ok: false });
    } finally {
      setNotesSubmitting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">{t("admin.loadingReports", "Loading reports...")}</p>
        </div>
      </Layout>
    );
  }

  if (!session || session.user.role !== "ADMIN") return null;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <Link
            href="/admin/dashboard"
            className="mb-4 inline-flex items-center gap-1 font-body text-sm font-medium text-forest-600 hover:text-forest-800 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            {t("admin.backToDashboard")}
          </Link>
          <h1 className="heading-lg">{t("admin.reports")}</h1>
          <p className="text-body mt-2">
            {t("admin.reportsDesc", "Review, investigate, and resolve user-submitted reports. Add notes and link to targets.")}
          </p>
        </div>

        {/* Filters */}
        <div className="card-elevated mb-8 animate-fade-in-up stagger-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="searchReport" className="label-text">
                {t("admin.searchReports", "Search reports")}
              </label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sage-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  id="searchReport"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("admin.searchReportsPlaceholder", "Search by reporter, reason, or target ID...")}
                  className="input-field !pl-10"
                />
              </div>
            </div>
            <div>
              <label htmlFor="reportStatusFilter" className="label-text">
                {t("admin.filterByStatus")}
              </label>
              <select
                id="reportStatusFilter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as ReportStatus | "ALL")}
                className="input-field w-auto min-w-[140px]"
              >
                <option value="ALL">{t("admin.allStatuses")}</option>
                <option value="OPEN">{t("status.open")}</option>
                <option value="REVIEWED">{t("status.reviewed")}</option>
                <option value="RESOLVED">{t("status.resolved")}</option>
                <option value="DISMISSED">{t("status.dismissed")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="targetFilter" className="label-text">
                {t("admin.filterByTarget", "Filter by target")}
              </label>
              <select
                id="targetFilter"
                value={filterTarget}
                onChange={(e) => setFilterTarget(e.target.value)}
                className="input-field w-auto min-w-[140px]"
              >
                <option value="ALL">{t("admin.allTargets", "All Targets")}</option>
                <option value="BROKER">{t("admin.brokerTarget", "Broker")}</option>
                <option value="REQUEST">{t("admin.requestTarget", "Request")}</option>
                <option value="CONVERSATION">{t("admin.conversationTarget", "Conversation")}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results count */}
        <p className="text-body-sm mb-4 animate-fade-in">
          {t("admin.showingReports", "Showing {{count}} report(s)").replace("{{count}}", String(reports.length))}
        </p>

        {/* Reports Table */}
        <div className="card-elevated !p-0 overflow-hidden animate-fade-in-up stagger-2">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-cream-200">
              <thead>
                <tr className="bg-forest-800">
                  <th className="px-4 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.reporter", "Reporter")}
                  </th>
                  <th className="px-4 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.targetLabel", "Target")}
                  </th>
                  <th className="px-4 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.reasonLabel", "Reason")}
                  </th>
                  <th className="px-4 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.statusLabel", "Status")}
                  </th>
                  <th className="px-4 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.notesLabel", "Notes")}
                  </th>
                  <th className="px-4 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.dateLabel", "Date")}
                  </th>
                  <th className="px-4 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200 bg-white">
                {reports.map((report) => {
                  const targetLink = getTargetLink(report.targetType, report.targetId);

                  return (
                    <tr key={report.id} className={`transition-colors ${report.status === "OPEN" ? "bg-rose-50/20" : "hover:bg-cream-50"}`}>
                      {/* Reporter */}
                      <td className="px-4 py-4">
                        <p className="font-body text-sm font-semibold text-forest-800">{report.reporter.name || "—"}</p>
                        <p className="font-body text-xs text-forest-700/60">{report.reporter.email}</p>
                      </td>

                      {/* Target */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide ${TARGET_BADGE[report.targetType] || TARGET_BADGE.BROKER}`}>
                          {report.targetType}
                        </span>
                        <div className="mt-1">
                          {targetLink ? (
                            <Link
                              href={targetLink}
                              className="font-mono text-[10px] text-forest-600 hover:underline"
                            >
                              {report.targetId.slice(0, 16)}...
                            </Link>
                          ) : (
                            <span className="font-mono text-[10px] text-forest-700/50">{report.targetId.slice(0, 16)}...</span>
                          )}
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="px-4 py-4 max-w-[200px]">
                        <p className="font-body text-sm text-forest-700/80 line-clamp-2" title={report.reason}>
                          {report.reason}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide ${STATUS_BADGE[report.status]}`}>
                          {report.status}
                        </span>
                        {report.resolvedAt && (
                          <p className="mt-1 font-body text-[10px] text-forest-700/40">
                            {formatDate(report.resolvedAt)}
                          </p>
                        )}
                      </td>

                      {/* Admin Notes */}
                      <td className="px-4 py-4 max-w-[160px]">
                        {report.adminNotes ? (
                          <p className="font-body text-xs text-forest-700/70 line-clamp-2 italic" title={report.adminNotes}>
                            {report.adminNotes}
                          </p>
                        ) : (
                          <span className="font-body text-xs text-sage-400">—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="whitespace-nowrap px-4 py-4 font-body text-sm text-forest-700/70">
                        {formatDate(report.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap px-4 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Investigate button - links to target */}
                          {targetLink && (
                            <Link
                              href={targetLink}
                              className="btn-secondary !px-3 !py-1.5 !text-xs !rounded-lg"
                            >
                              {t("admin.investigate", "View Target")}
                            </Link>
                          )}

                          {/* Add/Edit Notes */}
                          <button
                            onClick={() => {
                              setNotesModal({ id: report.id, currentNotes: report.adminNotes, currentStatus: report.status });
                              setNotesText(report.adminNotes || "");
                              setNotesNewStatus("");
                              setNotesMessage(null);
                            }}
                            className="btn-secondary !px-3 !py-1.5 !text-xs !rounded-lg"
                          >
                            {report.adminNotes ? t("admin.editNotes", "Edit Notes") : t("admin.addNotes", "Add Notes")}
                          </button>

                          {/* Quick status actions */}
                          {report.status === "OPEN" && (
                            <button
                              onClick={() => handleStatusChange(report.id, "REVIEWED")}
                              disabled={actionLoading === report.id}
                              className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-3 py-1.5 font-body text-xs font-semibold text-white transition-all hover:bg-amber-700 active:scale-[0.98] disabled:opacity-50"
                            >
                              {actionLoading === report.id ? "..." : t("admin.markReviewed")}
                            </button>
                          )}
                          {(report.status === "OPEN" || report.status === "REVIEWED") && (
                            <>
                              <button
                                onClick={() => handleStatusChange(report.id, "RESOLVED")}
                                disabled={actionLoading === report.id}
                                className="btn-primary !px-3 !py-1.5 !text-xs !rounded-lg disabled:opacity-50"
                              >
                                {actionLoading === report.id ? "..." : t("admin.resolve")}
                              </button>
                              <button
                                onClick={() => handleStatusChange(report.id, "DISMISSED")}
                                disabled={actionLoading === report.id}
                                className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-3 py-1.5 font-body text-xs font-semibold text-white transition-all hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
                              >
                                {actionLoading === report.id ? "..." : t("admin.dismiss")}
                              </button>
                            </>
                          )}
                          {(report.status === "RESOLVED" || report.status === "DISMISSED") && (
                            <button
                              onClick={() => handleStatusChange(report.id, "OPEN")}
                              disabled={actionLoading === report.id}
                              className="btn-secondary !px-3 !py-1.5 !text-xs !rounded-lg disabled:opacity-50"
                            >
                              {actionLoading === report.id ? "..." : t("admin.reopen", "Reopen")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-body-sm">
                      {t("admin.noReportsFound", "No reports found for the selected filters.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Admin Notes Modal */}
      {notesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-forest-900/50 backdrop-blur-sm"
            onClick={() => { if (!notesSubmitting) { setNotesModal(null); setNotesMessage(null); } }}
          />
          <div className="relative w-full max-w-lg animate-fade-in-up rounded-2xl bg-white p-8 shadow-2xl">
            <button
              onClick={() => { if (!notesSubmitting) { setNotesModal(null); setNotesMessage(null); } }}
              className="absolute right-4 top-4 rounded-lg p-1 text-sage-400 transition-colors hover:text-forest-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="heading-md mb-1">{t("admin.adminNotesTitle", "Admin Notes")}</h3>
            <p className="text-body-sm mb-6">
              {t("admin.adminNotesDesc", "Add investigation notes, resolution details, or follow-up actions for this report.")}
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="adminNotes" className="label-text">{t("admin.notesLabel", "Notes")}</label>
                <textarea
                  id="adminNotes"
                  rows={4}
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder={t("admin.notesPlaceholder", "e.g. Investigated broker profile. Warning issued. User contacted.")}
                  className="input-field resize-none"
                />
              </div>

              <div>
                <label htmlFor="notesStatus" className="label-text">
                  {t("admin.updateStatusOptional", "Update status (optional)")}
                </label>
                <select
                  id="notesStatus"
                  value={notesNewStatus}
                  onChange={(e) => setNotesNewStatus(e.target.value as ReportStatus | "")}
                  className="input-field"
                >
                  <option value="">{t("admin.keepCurrentStatus", "Keep current status")}</option>
                  {(["OPEN", "REVIEWED", "RESOLVED", "DISMISSED"] as ReportStatus[])
                    .filter((s) => s !== notesModal.currentStatus)
                    .map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                </select>
              </div>

              <button
                onClick={handleNotesSave}
                disabled={notesSubmitting}
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {notesSubmitting ? t("admin.saving", "Saving...") : t("admin.saveNotes", "Save Notes")}
              </button>
            </div>

            {notesMessage && (
              <div className={`mt-4 rounded-lg p-3 text-center font-body text-sm ${notesMessage.ok ? "bg-forest-50 text-forest-700" : "bg-red-50 text-red-700"}`}>
                {notesMessage.text}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});
