import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import AdminLayout from "@/components/AdminLayout";
import Pagination from "@/components/Pagination";
import { getRequestTitle, PRODUCT_LABEL_KEYS, INCOME_TYPE_LABEL_KEYS, TIMELINE_LABEL_KEYS } from "@/lib/requestConfig";

interface RequestRow {
  id: string;
  publicId: string;
  mortgageCategory: string;
  province: string;
  city: string | null;
  productTypes?: string[] | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  notes: string | null;
  rejectionReason: string | null;
  details: Record<string, unknown> | null;
  desiredTimeline: string | null;
  borrower: {
    id: string;
    name: string | null;
    email: string;
    status: string;
  };
  _count: {
    introductions: number;
    conversations: number;
  };
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-800",
  OPEN: "bg-forest-100 text-forest-700",
  IN_PROGRESS: "bg-sky-100 text-sky-800",
  CLOSED: "bg-sage-200 text-sage-700",
  EXPIRED: "bg-sage-200 text-sage-600",
  REJECTED: "bg-rose-100 text-rose-700",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(val: number | null): string {
  if (val == null) return "—";
  return "$" + val.toLocaleString();
}

export default function AdminRequests() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");

  // Paginated data
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  // Search & filter state — read initial status from URL query param
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState(() => {
    const qs = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("status") : null;
    return qs && ["PENDING_APPROVAL", "OPEN", "IN_PROGRESS", "CLOSED", "EXPIRED", "REJECTED"].includes(qs) ? qs : "ALL";
  });
  const [filterType, setFilterType] = useState("ALL");
  const [page, setPage] = useState(1);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  // Detail modal
  const [detailRequest, setDetailRequest] = useState<RequestRow | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Status change modal
  const [statusModal, setStatusModal] = useState<{ id: string; currentStatus: string } | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusReason, setStatusReason] = useState("");

  // Delete confirmation
  const [deleteModal, setDeleteModal] = useState<{ id: string; province: string; type: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Track highlight row
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync filterStatus when ?status= query param changes (e.g. navigating from another page)
  useEffect(() => {
    const qs = router.query.status;
    if (typeof qs === "string" && ["PENDING_APPROVAL", "OPEN", "IN_PROGRESS", "CLOSED", "EXPIRED", "REJECTED"].includes(qs)) {
      setFilterStatus(qs);
    }
  }, [router.query.status]);

  // Highlight row when ?highlight= query param is present
  useEffect(() => {
    const highlightId = router.query.highlight;
    if (typeof highlightId !== "string" || loading || requests.length === 0) return;

    const row = document.querySelector(`tr[data-request-id="${highlightId}"]`) as HTMLElement | null;
    if (!row) return;

    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.add("ring-2", "ring-amber-400", "bg-amber-50");

    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      row.classList.remove("ring-2", "ring-amber-400", "bg-amber-50");
    }, 3000);

    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, [router.query.highlight, loading, requests]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterStatus, filterType]);

  // Fetch paginated data
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        search: debouncedSearch,
        status: filterStatus,
        type: filterType,
      });
      const res = await fetch(`/api/admin/requests?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setRequests(json.data);
        setPagination(json.pagination);
      }
    } catch {
      // Network error
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterStatus, filterType]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") return;
    fetchRequests();
  }, [session, status, router, fetchRequests]);

  const handleStatusChange = async () => {
    if (!statusModal || !newStatus) return;
    setActionLoading(statusModal.id);

    try {
      const res = await fetch(`/api/admin/requests/${statusModal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, reason: statusReason }),
      });

      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) => (r.publicId === statusModal.id ? { ...r, status: newStatus } : r))
        );
        setActionMessage({ id: statusModal.id, text: t("admin.statusUpdated"), ok: true });
        setStatusModal(null);
        setNewStatus("");
        setStatusReason("");
      } else {
        const data = await res.json();
        setActionMessage({ id: statusModal.id, text: data.error, ok: false });
      }
    } catch {
      setActionMessage({ id: statusModal.id, text: "Failed to update", ok: false });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setActionLoading(deleteModal.id);

    try {
      const res = await fetch(`/api/admin/requests/${deleteModal.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason }),
      });

      if (res.ok) {
        setDeleteModal(null);
        setDeleteReason("");
        // Re-fetch current page (may now have fewer items)
        fetchRequests();
      } else {
        const data = await res.json();
        setActionMessage({ id: deleteModal.id, text: data.error, ok: false });
      }
    } catch {
      setActionMessage({ id: deleteModal.id, text: "Failed to delete", ok: false });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const handleQuickApprove = async (publicId: string) => {
    setActionLoading(publicId);
    try {
      const res = await fetch(`/api/admin/requests/${publicId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "OPEN" }),
      });
      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) => (r.publicId === publicId ? { ...r, status: "OPEN" } : r))
        );
        setActionMessage({ id: publicId, text: t("admin.requestApproved", "Request approved"), ok: true });
      } else {
        const data = await res.json();
        setActionMessage({ id: publicId, text: data.error, ok: false });
      }
    } catch {
      setActionMessage({ id: publicId, text: "Failed to approve", ok: false });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id);
    try {
      const res = await fetch(`/api/admin/requests/${rejectModal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED", reason: rejectReason }),
      });
      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) => (r.publicId === rejectModal.id ? { ...r, status: "REJECTED" } : r))
        );
        setActionMessage({ id: rejectModal.id, text: t("admin.requestRejected", "Request rejected"), ok: true });
        setRejectModal(null);
        setRejectReason("");
      } else {
        const data = await res.json();
        setActionMessage({ id: rejectModal.id, text: data.error, ok: false });
      }
    } catch {
      setActionMessage({ id: rejectModal.id, text: "Failed to reject", ok: false });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({ limit: "10000" });
      const res = await fetch(`/api/admin/requests?${params.toString()}`);
      if (!res.ok) return;
      const json = await res.json();
      const rows: RequestRow[] = json.data;

      const headers = ["ID", "Borrower Name", "Borrower Email", "Type", "Category", "Province", "City", "Status", "Introductions", "Conversations", "Created"];
      const csvRows = [
        headers.join(","),
        ...rows.map((r) =>
          [
            r.publicId,
            `"${(r.borrower.name || "").replace(/"/g, '""')}"`,
            r.borrower.email,
            getRequestTitle(r),
            r.mortgageCategory,
            r.province,
            r.city || "",
            r.status,
            r._count.introductions,
            r._count.conversations,
            formatDate(r.createdAt),
          ].join(",")
        ),
      ];

      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `requests-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Export error
    }
  };

  const fetchDetail = async (publicId: string) => {
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await fetch(`/api/admin/requests/${publicId}`);
      if (res.ok) setDetailData(await res.json());
    } catch {}
    finally { setDetailLoading(false); }
  };

  if (status === "loading" || (loading && requests.length === 0)) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">{t("admin.loadingRequests", "Loading requests...")}</p>
        </div>
      </AdminLayout>
    );
  }

  if (!session || session.user.role !== "ADMIN") return null;

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="heading-lg">{t("admin.requestManagement", "Request Management")}</h1>
              <p className="text-body mt-2">
                {t("admin.requestManagementDesc", "View, search, and manage all borrower mortgage requests.")}
              </p>
            </div>
            <button
              onClick={handleExportCSV}
              className="btn-secondary !px-4 !py-2 !text-sm"
            >
              {t("admin.exportCSV", "Export CSV")}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card-elevated mb-8 animate-fade-in-up stagger-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="searchReq" className="label-text">
                {t("admin.searchRequests", "Search requests")}
              </label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sage-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  id="searchReq"
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t("admin.searchRequestsPlaceholder", "Search by ID, borrower, province, city...")}
                  className="input-field !pl-10"
                />
              </div>
            </div>
            <div>
              <label htmlFor="statusFilter" className="label-text">
                {t("admin.filterByStatus", "Filter by status")}
              </label>
              <select
                id="statusFilter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input-field w-auto min-w-[140px]"
              >
                <option value="ALL">{t("admin.allStatuses", "All Statuses")}</option>
                <option value="PENDING_APPROVAL">{t("status.pendingApproval", "Pending Approval")}</option>
                <option value="OPEN">{t("status.open")}</option>
                <option value="IN_PROGRESS">{t("status.inProgress")}</option>
                <option value="CLOSED">{t("status.closed")}</option>
                <option value="EXPIRED">{t("status.expired")}</option>
                <option value="REJECTED">{t("status.rejected", "Rejected")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="typeFilter" className="label-text">
                {t("admin.filterByType", "Filter by category")}
              </label>
              <select
                id="typeFilter"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="input-field w-auto min-w-[140px]"
              >
                <option value="ALL">{t("admin.allTypes", "All Types")}</option>
                <option value="RESIDENTIAL">{t("request.residential", "Residential")}</option>
                <option value="COMMERCIAL">{t("request.commercial", "Commercial")}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results count */}
        <p className="text-body-sm mb-4 animate-fade-in">
          {t("admin.showingRequests", "Showing {{count}} request(s)").replace("{{count}}", String(pagination.total))}
        </p>

        {/* Requests Table */}
        <div className="card-elevated !p-0 overflow-hidden animate-fade-in-up stagger-2">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-cream-200">
              <thead>
                <tr className="bg-forest-800">
                  {["admin.requestId", "admin.borrowerLabel", "admin.type", "admin.location", "admin.statusLabel", "admin.introsConvos", "admin.created", "admin.actions"].map((key) => (
                    <th key={key} className="px-4 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                      {t(key, key.split(".").pop() ?? "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-body-sm">
                      {t("admin.loadingRequests", "Loading requests...")}
                    </td>
                  </tr>
                ) : requests.map((req) => (
                  <tr key={req.id} data-request-id={req.publicId} className="hover:bg-cream-50 transition-colors">
                    {/* Request ID */}
                    <td className="px-4 py-4">
                      <button
                        onClick={() => { setDetailRequest(req); fetchDetail(req.publicId); }}
                        className="font-mono text-xs text-forest-600 hover:text-forest-800 hover:underline"
                        title={req.publicId}
                      >
                        {req.publicId}
                      </button>
                    </td>

                    {/* Borrower */}
                    <td className="px-4 py-4">
                      <p className="font-body text-sm font-semibold text-forest-800">
                        {req.borrower.name || "—"}
                      </p>
                      <p className="font-body text-xs text-forest-700/60">{req.borrower.email}</p>
                    </td>

                    {/* Type */}
                    <td className="whitespace-nowrap px-4 py-4">
                      <div>
                        <span className="font-body text-sm text-forest-800">{getRequestTitle(req)}</span>
                        <p className="font-body text-[10px] text-forest-700/50">
                          {req.mortgageCategory}
                        </p>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="whitespace-nowrap px-4 py-4 font-body text-sm text-forest-700/80">
                      {req.province}{req.city ? `, ${req.city}` : ""}
                    </td>

                    {/* Status */}
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide ${STATUS_BADGE[req.status] || STATUS_BADGE.OPEN}`}>
                        {req.status}
                      </span>
                      {actionMessage?.id === req.publicId && (
                        <p className={`mt-1 font-body text-[10px] ${actionMessage.ok ? "text-forest-600" : "text-rose-600"}`}>
                          {actionMessage.text}
                        </p>
                      )}
                    </td>

                    {/* Intros / Convos */}
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="font-body text-xs text-forest-700/70" title="Introductions">
                          {req._count.introductions} intro
                        </span>
                        <span className="font-body text-xs text-forest-700/70" title="Conversations">
                          {req._count.conversations} conv
                        </span>
                      </div>
                    </td>

                    {/* Created */}
                    <td className="whitespace-nowrap px-4 py-4 font-body text-sm text-forest-700/70">
                      {formatDate(req.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {req.status === "PENDING_APPROVAL" && (
                          <>
                            <button
                              onClick={() => handleQuickApprove(req.publicId)}
                              disabled={actionLoading === req.publicId}
                              className="inline-flex items-center justify-center rounded-lg bg-forest-600 px-3 py-1.5 font-body text-xs font-semibold text-white transition-all hover:bg-forest-700 active:scale-[0.98] disabled:opacity-50"
                            >
                              {actionLoading === req.publicId ? "..." : t("admin.approveRequest", "Approve")}
                            </button>
                            <button
                              onClick={() => {
                                setRejectModal({ id: req.publicId });
                                setRejectReason("");
                              }}
                              className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-3 py-1.5 font-body text-xs font-semibold text-white transition-all hover:bg-rose-700 active:scale-[0.98]"
                            >
                              {t("admin.rejectRequest", "Reject")}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => { setDetailRequest(req); fetchDetail(req.publicId); }}
                          className="btn-secondary !px-3 !py-1.5 !text-xs !rounded-lg"
                        >
                          {t("admin.viewDetails", "Details")}
                        </button>
                        <button
                          onClick={() => {
                            setStatusModal({ id: req.publicId, currentStatus: req.status });
                            setNewStatus("");
                            setStatusReason("");
                          }}
                          className="btn-secondary !px-3 !py-1.5 !text-xs !rounded-lg"
                        >
                          {t("admin.changeStatus", "Status")}
                        </button>
                        <button
                          onClick={() => {
                            setDeleteModal({ id: req.publicId, province: req.province, type: getRequestTitle(req) });
                            setDeleteReason("");
                          }}
                          className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-3 py-1.5 font-body text-xs font-semibold text-white transition-all hover:bg-rose-700 active:scale-[0.98]"
                        >
                          {t("admin.deleteRequest", "Delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && requests.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-body-sm">
                      {t("admin.noRequestsFound", "No requests found.")}
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
          onPageChange={(p) => setPage(p)}
        />
      </div>

      {/* Detail Modal */}
      {detailRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-forest-900/50 backdrop-blur-sm" onClick={() => { setDetailRequest(null); setDetailData(null); }} />
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-fade-in-up rounded-2xl bg-white p-8 shadow-2xl">
            <button
              onClick={() => { setDetailRequest(null); setDetailData(null); }}
              className="absolute right-4 top-4 rounded-lg p-1 text-sage-400 transition-colors hover:text-forest-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Section 1: Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="heading-md">{t("admin.requestDetails", "Request Details")}</h3>
                <span className="font-mono text-xs text-forest-700/50">{detailRequest.publicId}</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide ${STATUS_BADGE[detailRequest.status] || STATUS_BADGE.OPEN}`}>
                  {detailRequest.status}
                </span>
              </div>
              <p className="font-body text-xs text-forest-700/60 mt-1">
                {t("admin.created", "Created")}: {formatDate(detailRequest.createdAt)} · {t("admin.updated", "Updated")}: {formatDate(detailRequest.updatedAt)}
              </p>
              {detailRequest.status === "REJECTED" && detailRequest.rejectionReason && (
                <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3">
                  <p className="font-body text-xs font-semibold text-rose-700">{t("admin.rejectionReason", "Rejection Reason")}</p>
                  <p className="font-body text-sm text-rose-800">{detailRequest.rejectionReason}</p>
                </div>
              )}
            </div>

            {/* Section 2: Borrower Info */}
            <div className="card-elevated mb-6">
              <h4 className="heading-sm mb-3">{t("admin.borrowerInfo", "Borrower Info")}</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="label-text">{t("admin.nameLabel", "Name")}</p>
                  <p className="font-body text-sm font-semibold text-forest-800">{detailRequest.borrower.name || "—"}</p>
                </div>
                <div>
                  <p className="label-text">{t("admin.emailLabel", "Email")}</p>
                  <p className="font-body text-sm text-forest-800">{detailRequest.borrower.email}</p>
                </div>
                <div>
                  <p className="label-text">{t("admin.accountStatus", "Account Status")}</p>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase ${detailRequest.borrower.status === "ACTIVE" ? "bg-forest-100 text-forest-700" : "bg-sage-200 text-sage-700"}`}>
                    {detailRequest.borrower.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 3: Request Details */}
            <div className="card-elevated mb-6">
              <h4 className="heading-sm mb-3">{t("admin.requestDetails", "Request Details")}</h4>

              {detailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-6 w-6 text-forest-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="label-text">{t("request.mortgageCategory", "Mortgage Category")}</p>
                      <p className="font-body text-sm text-forest-800">{(detailData || detailRequest).mortgageCategory === "COMMERCIAL" ? t("request.commercial", "Commercial") : t("request.residential", "Residential")}</p>
                    </div>
                    <div>
                      <p className="label-text">{t("admin.location", "Location")}</p>
                      <p className="font-body text-sm text-forest-800">{(detailData || detailRequest).province}{(detailData || detailRequest).city ? `, ${(detailData || detailRequest).city}` : ""}</p>
                    </div>
                  </div>

                  <div>
                    <p className="label-text">{t("request.selectProducts", "Products")}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {((detailData || detailRequest).productTypes ?? []).map((pt: string) => (
                        <span key={pt} className="inline-flex items-center rounded-full bg-cream-200 px-2.5 py-0.5 font-body text-xs font-medium text-forest-700">
                          {t(PRODUCT_LABEL_KEYS[pt] ?? pt)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Residential sub-details */}
                  {(detailData || detailRequest).mortgageCategory === "RESIDENTIAL" && (detailData?.details || detailRequest.details) && (() => {
                    const details = detailData?.details || detailRequest.details;
                    return (
                      <div className="rounded-lg bg-cream-50 p-4 space-y-3">
                        <p className="font-body text-xs font-semibold uppercase tracking-wide text-forest-600">{t("request.residential", "Residential")} Details</p>
                        {details.purposeOfUse && (
                          <div>
                            <p className="label-text">{t("request.purposeOfUse", "Purpose of Use")}</p>
                            <p className="font-body text-sm text-forest-800">{details.purposeOfUse === "OWNER_OCCUPIED" ? t("request.ownerOccupied", "Owner Occupied") : t("request.rental", "Rental")}</p>
                          </div>
                        )}
                        {details.incomeTypes && Array.isArray(details.incomeTypes) && details.incomeTypes.length > 0 && (
                          <div>
                            <p className="label-text">{t("request.incomeType", "Income Types")}</p>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {(details.incomeTypes as string[]).map((it: string) => (
                                <span key={it} className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 font-body text-xs font-medium text-amber-800">
                                  {t(INCOME_TYPE_LABEL_KEYS[it] ?? it)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {details.incomeTypeOther && (
                          <div>
                            <p className="label-text">{t("request.incomeTypeOther", "Income Type (Other)")}</p>
                            <p className="font-body text-sm text-forest-800">{details.incomeTypeOther as string}</p>
                          </div>
                        )}
                        {details.annualIncome && typeof details.annualIncome === "object" && (
                          <div>
                            <p className="label-text">{t("request.annualIncome", "Annual Income")}</p>
                            <div className="grid grid-cols-3 gap-2 mt-1">
                              {Object.entries(details.annualIncome as Record<string, number>).map(([year, amount]) => (
                                <div key={year} className="rounded-lg bg-white p-2 text-center border border-cream-200">
                                  <p className="font-body text-xs text-forest-700/60">{year}</p>
                                  <p className="font-body text-sm font-semibold text-forest-800">{formatCurrency(amount)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Commercial sub-details */}
                  {(detailData || detailRequest).mortgageCategory === "COMMERCIAL" && (detailData?.details || detailRequest.details) && (() => {
                    const details = detailData?.details || detailRequest.details;
                    return (
                      <div className="rounded-lg bg-cream-50 p-4 space-y-3">
                        <p className="font-body text-xs font-semibold uppercase tracking-wide text-forest-600">{t("request.commercial", "Commercial")} Details</p>
                        {details.businessType && (
                          <div>
                            <p className="label-text">{t("request.businessType", "Business Type")}</p>
                            <p className="font-body text-sm text-forest-800">{details.businessType as string}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-4">
                          {details.corporateAnnualIncome != null && (
                            <div>
                              <p className="label-text">{t("request.corporateAnnualIncome", "Corporate Annual Income")}</p>
                              <p className="font-body text-sm text-forest-800">{formatCurrency(details.corporateAnnualIncome as number)}</p>
                            </div>
                          )}
                          {details.corporateAnnualExpenses != null && (
                            <div>
                              <p className="label-text">{t("request.corporateAnnualExpenses", "Corporate Annual Expenses")}</p>
                              <p className="font-body text-sm text-forest-800">{formatCurrency(details.corporateAnnualExpenses as number)}</p>
                            </div>
                          )}
                          {details.ownerNetIncome != null && (
                            <div>
                              <p className="label-text">{t("request.ownerNetIncome", "Owner Net Income")}</p>
                              <p className="font-body text-sm text-forest-800">{formatCurrency(details.ownerNetIncome as number)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="label-text">{t("request.desiredTimeline", "Desired Timeline")}</p>
                      <p className="font-body text-sm text-forest-800">
                        {(detailData?.desiredTimeline || detailRequest.desiredTimeline)
                          ? t(TIMELINE_LABEL_KEYS[detailData?.desiredTimeline || detailRequest.desiredTimeline!] ?? (detailData?.desiredTimeline || detailRequest.desiredTimeline))
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {(detailData?.notes || detailRequest.notes) && (
                    <div>
                      <p className="label-text">{t("admin.borrowerNotes", "Borrower Notes")}</p>
                      <p className="font-body text-sm text-forest-700/80 bg-cream-50 rounded-lg p-3">{detailData?.notes || detailRequest.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 4: Broker Introductions */}
            <div className="card-elevated mb-6">
              <h4 className="heading-sm mb-3">{t("admin.introductionDetails", "Broker Introductions")}</h4>
              {detailLoading ? (
                <div className="flex items-center justify-center py-6">
                  <svg className="animate-spin h-5 w-5 text-forest-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : detailData?.introductions && detailData.introductions.length > 0 ? (
                <div className="space-y-3">
                  {detailData.introductions.map((intro: any, idx: number) => (
                    <div key={idx} className="rounded-lg border border-cream-200 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-body text-sm font-semibold text-forest-800">
                            {t("admin.brokerNameLabel", "Broker")}: {intro.broker?.user?.name || "—"}
                          </p>
                          <p className="font-body text-xs text-forest-700/60">
                            {t("admin.brokerageLabel", "Brokerage")}: {intro.broker?.brokerageName || "—"} · {intro.broker?.user?.email || "—"}
                          </p>
                        </div>
                        <p className="font-body text-xs text-forest-700/50">{formatDate(intro.createdAt)}</p>
                      </div>
                      <div>
                        <p className="label-text">{t("admin.introMessage", "Message")}</p>
                        <p className="font-body text-sm text-forest-800 bg-cream-50 rounded-lg p-2 whitespace-pre-line">{intro.message || intro.howCanHelp || "—"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-body-sm text-forest-700/50">{t("admin.noIntroductionsShort", "No introductions yet.")}</p>
              )}
            </div>

            {/* Section 5: Conversations Summary */}
            <div className="card-elevated mb-4">
              <h4 className="heading-sm mb-3">{t("admin.conversationSummary", "Conversations Summary")}</h4>
              {detailLoading ? (
                <div className="flex items-center justify-center py-6">
                  <svg className="animate-spin h-5 w-5 text-forest-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : detailData?.conversations && detailData.conversations.length > 0 ? (
                <div className="space-y-2">
                  {detailData.conversations.map((conv: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border border-cream-200 p-3">
                      <div>
                        <p className="font-body text-sm font-semibold text-forest-800">
                          {conv.broker?.user?.name || "—"}
                        </p>
                        <p className="font-body text-xs text-forest-700/60">
                          {conv.broker?.brokerageName || "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-body text-[11px] font-semibold uppercase ${conv.status === "ACTIVE" ? "bg-forest-100 text-forest-700" : "bg-sage-200 text-sage-700"}`}>
                          {conv.status}
                        </span>
                        <span className="font-body text-xs text-forest-700/70">
                          {t("admin.messageCount", "Messages")}: {conv._count?.messages ?? 0}
                        </span>
                        <span className="font-body text-xs text-forest-700/50">
                          {t("admin.lastActivityLabel", "Last activity")}: {formatDate(conv.updatedAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-body-sm text-forest-700/50">{t("admin.noConversationsShort", "No conversations yet.")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-forest-900/50 backdrop-blur-sm" onClick={() => setStatusModal(null)} />
          <div className="relative w-full max-w-md animate-fade-in-up rounded-2xl bg-white p-8 shadow-2xl">
            <button
              onClick={() => setStatusModal(null)}
              className="absolute right-4 top-4 rounded-lg p-1 text-sage-400 transition-colors hover:text-forest-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="heading-md mb-1">{t("admin.changeRequestStatus", "Change Request Status")}</h3>
            <p className="text-body-sm mb-6">
              {t("admin.currentStatusLabel", "Current status:")} <span className="font-semibold">{statusModal.currentStatus}</span>
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="newStatus" className="label-text">{t("admin.newStatus", "New Status")}</label>
                <select
                  id="newStatus"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="input-field"
                >
                  <option value="">{t("admin.selectStatus", "Select status...")}</option>
                  {["PENDING_APPROVAL", "OPEN", "IN_PROGRESS", "CLOSED", "EXPIRED", "REJECTED"]
                    .filter((s) => s !== statusModal.currentStatus)
                    .map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                </select>
              </div>
              <div>
                <label htmlFor="statusReason" className="label-text">{t("admin.reason")}</label>
                <input
                  id="statusReason"
                  type="text"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder={t("admin.statusReasonPlaceholder", "e.g. Spam request, user requested closure")}
                  className="input-field"
                />
              </div>
              <button
                onClick={handleStatusChange}
                disabled={!newStatus || actionLoading === statusModal.id}
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading === statusModal.id ? "..." : t("admin.confirmStatusChange", "Confirm Status Change")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-forest-900/50 backdrop-blur-sm" onClick={() => setRejectModal(null)} />
          <div className="relative w-full max-w-md animate-fade-in-up rounded-2xl bg-white p-8 shadow-2xl">
            <button
              onClick={() => setRejectModal(null)}
              className="absolute right-4 top-4 rounded-lg p-1 text-sage-400 transition-colors hover:text-forest-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                <svg className="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <h3 className="heading-md">{t("admin.rejectRequest", "Reject Request")}</h3>
            </div>

            <p className="text-body-sm mb-4">
              {t("admin.rejectConfirm", "Reject this request? Please provide a reason.")}
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="rejectReason" className="label-text">{t("admin.rejectionReason", "Rejection Reason")}</label>
                <input
                  id="rejectReason"
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t("admin.rejectReasonPlaceholder", "e.g. Incomplete information, spam")}
                  className="input-field"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setRejectModal(null)}
                  className="btn-secondary flex-1"
                >
                  {t("common.cancel", "Cancel")}
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading === rejectModal.id}
                  className="flex-1 inline-flex items-center justify-center rounded-xl bg-rose-600 px-6 py-3 font-body text-sm font-semibold text-white transition-all hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading === rejectModal.id ? "..." : t("admin.confirmReject", "Reject Request")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-forest-900/50 backdrop-blur-sm" onClick={() => setDeleteModal(null)} />
          <div className="relative w-full max-w-md animate-fade-in-up rounded-2xl bg-white p-8 shadow-2xl">
            <button
              onClick={() => setDeleteModal(null)}
              className="absolute right-4 top-4 rounded-lg p-1 text-sage-400 transition-colors hover:text-forest-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                <svg className="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <h3 className="heading-md">{t("admin.deleteRequestTitle", "Delete Request")}</h3>
            </div>

            <p className="text-body-sm mb-2">
              {t("admin.deleteRequestWarning", "This will permanently delete this request and all related data (introductions, conversations, messages).")}
            </p>
            <p className="font-body text-sm font-semibold text-forest-800 mb-4">
              {deleteModal.type} · {deleteModal.province}
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="deleteReason" className="label-text">{t("admin.reason")}</label>
                <input
                  id="deleteReason"
                  type="text"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder={t("admin.deleteReasonPlaceholder", "e.g. Spam/fraud request")}
                  className="input-field"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteModal(null)}
                  className="btn-secondary flex-1"
                >
                  {t("common.cancel", "Cancel")}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading === deleteModal.id}
                  className="flex-1 inline-flex items-center justify-center rounded-xl bg-rose-600 px-6 py-3 font-body text-sm font-semibold text-white transition-all hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading === deleteModal.id ? "..." : t("admin.confirmDelete", "Delete Permanently")}
                </button>
              </div>
            </div>
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
