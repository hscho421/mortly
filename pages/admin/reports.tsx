import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import Head from "next/head";
import AdminLayout from "@/components/AdminLayout";
import Pagination from "@/components/Pagination";
import StatusBadge from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { downloadCSV } from "@/lib/csvExport";

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

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const TARGET_BADGE: Record<string, string> = {
  BROKER: "bg-forest-100 text-forest-700 ring-1 ring-inset ring-forest-600/20",
  REQUEST: "bg-sage-100 text-sage-700 ring-1 ring-inset ring-sage-600/20",
  CONVERSATION: "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-600/20",
  USER: "bg-cream-200 text-forest-800 ring-1 ring-inset ring-forest-600/20",
  BORROWER: "bg-cream-200 text-forest-800 ring-1 ring-inset ring-forest-600/20",
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
      return `/admin/brokers/${targetId}`;
    case "REQUEST":
      return `/admin/requests?highlight=${targetId}`;
    case "CONVERSATION":
      return `/admin/conversations/${targetId}`;
    case "USER":
    case "BORROWER":
      return `/admin/users?highlight=${targetId}`;
    default:
      return null;
  }
}

export default function AdminReports() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");
  const { toast } = useToast();

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const initialStatus = (router.query.status as string) || "ALL";
  const [filterStatus, setFilterStatus] = useState<ReportStatus | "ALL">(
    (["OPEN", "REVIEWED", "RESOLVED", "DISMISSED"] as string[]).includes(initialStatus)
      ? (initialStatus as ReportStatus)
      : "ALL"
  );
  const [filterTarget, setFilterTarget] = useState("ALL");

  // Sync filter from query param changes (e.g. navigating from dashboard links)
  useEffect(() => {
    const qs = router.query.status as string | undefined;
    if (qs && (["OPEN", "REVIEWED", "RESOLVED", "DISMISSED"] as string[]).includes(qs)) {
      setFilterStatus(qs as ReportStatus);
      setPage(1);
    }
  }, [router.query.status]);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Notes modal
  const [notesModal, setNotesModal] = useState<{ id: string; currentNotes: string | null; currentStatus: ReportStatus } | null>(null);
  const [notesText, setNotesText] = useState("");
  const [notesNewStatus, setNotesNewStatus] = useState<ReportStatus | "">("");
  const [notesSubmitting, setNotesSubmitting] = useState(false);
  const [notesMessage, setNotesMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const fetchReports = useCallback(async () => {
    if (!session || session.user.role !== "ADMIN") return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      if (filterTarget !== "ALL") params.set("targetType", filterTarget);

      const res = await fetch(`/api/admin/reports?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setReports(json.data);
        setPagination(json.pagination);
      }
    } catch {
      // Network error
    } finally {
      setLoading(false);
    }
  }, [session, page, debouncedSearch, filterStatus, filterTarget]);

  // Auth guard
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") return;
  }, [session, status, router]);

  // Fetch on page/filter changes
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") return;
    fetchReports();
  }, [fetchReports, session, status]);

  // Reset to page 1 when filters/search change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterStatus, filterTarget]);

  const handleStatusChange = async (reportId: string, newStatus: ReportStatus) => {
    setActionLoading(reportId);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast(t("admin.reportUpdated", "Report updated"), "success");
        await fetchReports();
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data?.error || t("admin.failedToUpdate", "Failed to update"), "error");
      }
    } catch (err) {
      toast((err as Error)?.message || t("admin.failedToUpdate", "Failed to update"), "error");
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
        toast(t("admin.reportUpdated", "Report updated"), "success");
        setNotesMessage({ text: t("admin.notesSaved", "Notes saved successfully"), ok: true });
        setTimeout(async () => {
          setNotesModal(null);
          setNotesMessage(null);
          await fetchReports();
        }, 1200);
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = data?.error || t("admin.failedToSave", "Failed to save");
        setNotesMessage({ text: msg, ok: false });
        toast(msg, "error");
      }
    } catch (err) {
      const msg = (err as Error)?.message || t("admin.failedToSave", "Failed to save");
      setNotesMessage({ text: msg, ok: false });
      toast(msg, "error");
    } finally {
      setNotesSubmitting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">{t("admin.loadingReports", "Loading reports...")}</p>
        </div>
      </AdminLayout>
    );
  }

  if (!session || session.user.role !== "ADMIN") return null;

  return (
    <AdminLayout>
      <Head><title>{t("titles.adminReports")}</title></Head>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header — editorial */}
        <div className="mb-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="eyebrow">— {t("admin.sidebar.reports")}</div>
              <h1 className="heading-lg mt-3">{t("admin.reports")}</h1>
              <p className="text-body mt-2 max-w-2xl">
                {t("admin.reportsDesc", "Review, investigate, and resolve user-submitted reports. Add notes and link to targets.")}
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  const params = new URLSearchParams({ limit: "10000" });
                  if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
                  if (filterStatus !== "ALL") params.set("status", filterStatus);
                  if (filterTarget !== "ALL") params.set("targetType", filterTarget);

                  const res = await fetch(`/api/admin/reports?${params.toString()}`);
                  if (!res.ok) return;
                  const json = await res.json();
                  const allReports: ReportRow[] = json.data;

                  const headers = [t("admin.csv.id", "ID"), t("admin.csv.reporter", "Reporter"), t("admin.csv.targetType", "Target Type"), t("admin.csv.targetId", "Target ID"), t("admin.csv.reason", "Reason"), t("admin.csv.status", "Status"), t("admin.csv.adminNotes", "Admin Notes"), t("admin.csv.created", "Created"), t("admin.csv.resolved", "Resolved")];
                  const rows = allReports.map((r) => [
                    r.id,
                    r.reporter.name || r.reporter.email,
                    r.targetType,
                    r.targetId,
                    r.reason,
                    r.status,
                    r.adminNotes || "",
                    new Date(r.createdAt).toISOString().slice(0, 10),
                    r.resolvedAt ? new Date(r.resolvedAt).toISOString().slice(0, 10) : "",
                  ]);
                  downloadCSV("reports_export", headers, rows);
                } catch {
                  // export error
                }
              }}
              className="rounded-sm border border-cream-300 bg-cream-50 text-forest-800 px-3.5 py-2 font-body text-xs font-semibold hover:bg-cream-200 whitespace-nowrap"
            >
              ⬇ {t("admin.exportCsv", "Export CSV")}
            </button>
          </div>
        </div>

        {/* Search + Filter chips */}
        <div className="mb-4 animate-fade-in-up stagger-1">
          <div className="relative mb-4">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sage-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              id="searchReport"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("admin.searchReportsPlaceholder", "Search by reporter, reason, or target ID...")}
              className="input-field !pl-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pb-3">
            {[
              { v: "ALL" as const, label: t("admin.allStatuses") },
              { v: "OPEN" as const, label: t("status.open") },
              { v: "REVIEWED" as const, label: t("status.reviewed") },
              { v: "RESOLVED" as const, label: t("status.resolved") },
              { v: "DISMISSED" as const, label: t("status.dismissed") },
            ].map((f) => {
              const on = filterStatus === f.v;
              return (
                <button
                  key={f.v}
                  onClick={() => setFilterStatus(f.v)}
                  className={`px-3 py-1.5 font-body text-[12px] rounded-sm border transition-colors ${
                    on
                      ? "bg-forest-800 text-cream-50 border-forest-800 font-semibold"
                      : "bg-cream-50 text-forest-700 border-cream-300 hover:bg-cream-200"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
            <div className="w-px self-stretch bg-cream-300 mx-1" />
            {[
              { v: "ALL", label: t("admin.allTargets", "All Targets") },
              { v: "BROKER", label: t("admin.brokerTarget", "Broker") },
              { v: "REQUEST", label: t("admin.requestTarget", "Request") },
              { v: "CONVERSATION", label: t("admin.conversationTarget", "Conversation") },
            ].map((f) => {
              const on = filterTarget === f.v;
              return (
                <button
                  key={`t-${f.v}`}
                  onClick={() => setFilterTarget(f.v)}
                  className={`px-3 py-1.5 font-body text-[12px] rounded-sm border transition-colors ${
                    on
                      ? "bg-forest-800 text-cream-50 border-forest-800 font-semibold"
                      : "bg-cream-50 text-forest-700 border-cream-300 hover:bg-cream-200"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results count */}
        <p className="font-mono text-[11px] text-sage-500 tracking-[0.1em] mb-4 animate-fade-in">
          {t("admin.showingReports", "Showing {{count}} report(s)").replace("{{count}}", String(pagination.total))}
        </p>

        {/* Reports Table */}
        <div className="rounded-sm border border-cream-300 bg-cream-50 overflow-hidden animate-fade-in-up stagger-2">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-cream-100 border-b border-cream-300">
                  <th className="px-4 py-3 text-left mono-label">{t("admin.reporter", "Reporter")}</th>
                  <th className="px-4 py-3 text-left mono-label">{t("admin.targetLabel", "Target")}</th>
                  <th className="px-4 py-3 text-left mono-label">{t("admin.reasonLabel", "Reason")}</th>
                  <th className="px-4 py-3 text-left mono-label">{t("admin.statusLabel", "Status")}</th>
                  <th className="px-4 py-3 text-left mono-label">{t("admin.notesLabel", "Notes")}</th>
                  <th className="px-4 py-3 text-left mono-label">{t("admin.dateLabel", "Date")}</th>
                  <th className="px-4 py-3 text-right mono-label">{t("admin.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report, idx) => {
                  const targetLink = getTargetLink(report.targetType, report.targetId);

                  return (
                    <tr key={report.id} className={`transition-colors ${report.status === "OPEN" ? "bg-red-50/30 border-l-[3px] border-red-500" : "hover:bg-cream-100"} ${idx < reports.length - 1 ? "border-b border-cream-200" : ""}`}>
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
                              {report.targetId}
                            </Link>
                          ) : (
                            <span className="font-mono text-[10px] text-forest-700/50">{report.targetId}</span>
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
                        <StatusBadge status={report.status} />
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

        {/* Pagination */}
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={setPage}
        />
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
    </AdminLayout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});
