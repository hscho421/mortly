import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import Layout from "@/components/Layout";
import Pagination from "@/components/Pagination";

interface RequestRow {
  id: string;
  requestType: string;
  mortgageCategory: string;
  province: string;
  city: string | null;
  propertyType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  notes: string | null;
  priceRangeMin: number | null;
  priceRangeMax: number | null;
  mortgageAmountMin: number | null;
  mortgageAmountMax: number | null;
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
  OPEN: "bg-forest-100 text-forest-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  CLOSED: "bg-sage-200 text-sage-700",
  EXPIRED: "bg-rose-100 text-rose-700",
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
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  // Search & filter state
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [page, setPage] = useState(1);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  // Detail modal
  const [detailRequest, setDetailRequest] = useState<RequestRow | null>(null);

  // Status change modal
  const [statusModal, setStatusModal] = useState<{ id: string; currentStatus: string } | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusReason, setStatusReason] = useState("");

  // Delete confirmation
  const [deleteModal, setDeleteModal] = useState<{ id: string; province: string; type: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

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
        limit: "25",
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
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/login", undefined, { locale: router.locale });
      return;
    }
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
          prev.map((r) => (r.id === statusModal.id ? { ...r, status: newStatus } : r))
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

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({ limit: "10000" });
      const res = await fetch(`/api/admin/requests?${params.toString()}`);
      if (!res.ok) return;
      const json = await res.json();
      const rows: RequestRow[] = json.data;

      const headers = ["ID", "Borrower Name", "Borrower Email", "Type", "Category", "Property Type", "Province", "City", "Status", "Introductions", "Conversations", "Created"];
      const csvRows = [
        headers.join(","),
        ...rows.map((r) =>
          [
            r.id,
            `"${(r.borrower.name || "").replace(/"/g, '""')}"`,
            r.borrower.email,
            r.requestType,
            r.mortgageCategory,
            r.propertyType,
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

  if (status === "loading" || (loading && requests.length === 0)) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">{t("admin.loadingRequests", "Loading requests...")}</p>
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
                <option value="OPEN">{t("status.open")}</option>
                <option value="IN_PROGRESS">{t("status.inProgress")}</option>
                <option value="CLOSED">{t("status.closed")}</option>
                <option value="EXPIRED">{t("status.expired")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="typeFilter" className="label-text">
                {t("admin.filterByType", "Filter by type")}
              </label>
              <select
                id="typeFilter"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="input-field w-auto min-w-[140px]"
              >
                <option value="ALL">{t("admin.allTypes", "All Types")}</option>
                <option value="PURCHASE">Purchase</option>
                <option value="REFINANCE">Refinance</option>
                <option value="RENEWAL">Renewal</option>
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
                  <tr key={req.id} className="hover:bg-cream-50 transition-colors">
                    {/* Request ID */}
                    <td className="px-4 py-4">
                      <button
                        onClick={() => setDetailRequest(req)}
                        className="font-mono text-xs text-forest-600 hover:text-forest-800 hover:underline"
                        title={req.id}
                      >
                        {req.id.slice(0, 12)}...
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
                        <span className="font-body text-sm text-forest-800">{req.requestType}</span>
                        <p className="font-body text-[10px] text-forest-700/50">{req.mortgageCategory} · {req.propertyType}</p>
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
                      {actionMessage?.id === req.id && (
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
                        <button
                          onClick={() => setDetailRequest(req)}
                          className="btn-secondary !px-3 !py-1.5 !text-xs !rounded-lg"
                        >
                          {t("admin.viewDetails", "Details")}
                        </button>
                        <button
                          onClick={() => {
                            setStatusModal({ id: req.id, currentStatus: req.status });
                            setNewStatus("");
                            setStatusReason("");
                          }}
                          className="btn-secondary !px-3 !py-1.5 !text-xs !rounded-lg"
                        >
                          {t("admin.changeStatus", "Status")}
                        </button>
                        <button
                          onClick={() => {
                            setDeleteModal({ id: req.id, province: req.province, type: req.requestType });
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
          <div className="absolute inset-0 bg-forest-900/50 backdrop-blur-sm" onClick={() => setDetailRequest(null)} />
          <div className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto animate-fade-in-up rounded-2xl bg-white p-8 shadow-2xl">
            <button
              onClick={() => setDetailRequest(null)}
              className="absolute right-4 top-4 rounded-lg p-1 text-sage-400 transition-colors hover:text-forest-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="heading-md mb-1">{t("admin.requestDetails", "Request Details")}</h3>
            <p className="font-mono text-xs text-forest-700/50 mb-6">{detailRequest.id}</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="label-text">{t("admin.borrowerLabel", "Borrower")}</p>
                <p className="font-body text-sm font-semibold text-forest-800">{detailRequest.borrower.name || "—"}</p>
                <p className="font-body text-xs text-forest-700/60">{detailRequest.borrower.email}</p>
              </div>
              <div>
                <p className="label-text">{t("admin.statusLabel", "Status")}</p>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase ${STATUS_BADGE[detailRequest.status]}`}>
                  {detailRequest.status}
                </span>
              </div>
              <div>
                <p className="label-text">{t("admin.type", "Type")}</p>
                <p className="font-body text-sm text-forest-800">{detailRequest.requestType} · {detailRequest.mortgageCategory}</p>
              </div>
              <div>
                <p className="label-text">{t("admin.propertyType", "Property Type")}</p>
                <p className="font-body text-sm text-forest-800">{detailRequest.propertyType}</p>
              </div>
              <div>
                <p className="label-text">{t("admin.location", "Location")}</p>
                <p className="font-body text-sm text-forest-800">{detailRequest.province}{detailRequest.city ? `, ${detailRequest.city}` : ""}</p>
              </div>
              <div>
                <p className="label-text">{t("admin.priceRange", "Price Range")}</p>
                <p className="font-body text-sm text-forest-800">
                  {formatCurrency(detailRequest.priceRangeMin)} — {formatCurrency(detailRequest.priceRangeMax)}
                </p>
              </div>
              <div>
                <p className="label-text">{t("admin.mortgageAmount", "Mortgage Amount")}</p>
                <p className="font-body text-sm text-forest-800">
                  {formatCurrency(detailRequest.mortgageAmountMin)} — {formatCurrency(detailRequest.mortgageAmountMax)}
                </p>
              </div>
              <div>
                <p className="label-text">{t("admin.created", "Created")}</p>
                <p className="font-body text-sm text-forest-800">{formatDate(detailRequest.createdAt)}</p>
              </div>
            </div>

            {detailRequest.notes && (
              <div className="mb-6">
                <p className="label-text">{t("admin.borrowerNotes", "Borrower Notes")}</p>
                <p className="font-body text-sm text-forest-700/80 bg-cream-50 rounded-lg p-3">{detailRequest.notes}</p>
              </div>
            )}

            <div className="flex items-center gap-4 border-t border-cream-200 pt-4">
              <div className="flex-1">
                <p className="font-body text-sm text-forest-700">
                  <span className="font-semibold">{detailRequest._count.introductions}</span> {t("admin.introductionsLabel", "introduction(s)")} ·{" "}
                  <span className="font-semibold">{detailRequest._count.conversations}</span> {t("admin.conversationsLabel", "conversation(s)")}
                </p>
              </div>
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
                  {["OPEN", "IN_PROGRESS", "CLOSED", "EXPIRED"]
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
              {t("admin.deleteRequestWarning", "This will permanently delete this request and all related data (introductions, conversations, messages, reviews).")}
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
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});
