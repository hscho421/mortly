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

interface UserRow {
  id: string;
  publicId: string;
  email: string;
  name: string | null;
  role: "BORROWER" | "BROKER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  createdAt: string;
  broker: {
    id: string;
    verificationStatus: string;
    subscriptionTier: string;
    responseCredits: number;
    brokerageName: string;
  } | null;
  _count: {
    borrowerRequests: number;
    conversations: number;
    reviews: number;
  };
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ROLE_BADGE: Record<string, string> = {
  BORROWER: "bg-sage-100 text-sage-700 ring-1 ring-inset ring-sage-600/20",
  BROKER: "bg-forest-100 text-forest-700 ring-1 ring-inset ring-forest-600/20",
  ADMIN: "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-600/20",
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-forest-100 text-forest-700",
  SUSPENDED: "bg-amber-100 text-amber-800",
  BANNED: "bg-rose-100 text-rose-700",
};

const TIER_BADGE: Record<string, string> = {
  FREE: "bg-cream-200 text-forest-600",
  BASIC: "bg-sage-100 text-sage-700",
  PRO: "bg-forest-100 text-forest-700",
  PREMIUM: "bg-amber-100 text-amber-800",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminUsers() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");

  // Paginated data
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Search with debounce
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Filters & page
  const [filterRole, setFilterRole] = useState("ALL");
  const [page, setPage] = useState(1);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  // Credit adjustment modal state
  const [creditModal, setCreditModal] = useState<{
    brokerId: string;
    brokerName: string;
    currentCredits: number;
  } | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [creditSubmitting, setCreditSubmitting] = useState(false);
  const [creditMessage, setCreditMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Notice modal state
  const [noticeModal, setNoticeModal] = useState<{ userId: string; userName: string } | null>(null);
  const [noticeSubject, setNoticeSubject] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [noticeSubmitting, setNoticeSubmitting] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Invite admin modal state
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset to page 1 when search or role filter changes
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearch, filterRole]);

  // Fetch paginated users
  const fetchUsers = useCallback(async () => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
        search: debouncedSearch,
        role: filterRole,
      });
      const res = await fetch(`/api/admin/users?${params}`);
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data);
        setPagination(json.pagination);
      }
    } catch {
      // Network error
    } finally {
      setLoading(false);
    }
  }, [session, status, page, debouncedSearch, filterRole]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/login", undefined, { locale: router.locale });
      return;
    }
    fetchUsers();
  }, [fetchUsers, session, status, router]);

  // Clear selection when page changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    setActionLoading(userId);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status: data.status } : u))
        );
        setActionMessage({ id: userId, text: t("admin.statusUpdated", "Status updated"), ok: true });
      } else {
        setActionMessage({ id: userId, text: data.error, ok: false });
      }
    } catch {
      setActionMessage({ id: userId, text: "Failed to update status", ok: false });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const handleCreditAdjust = async () => {
    if (!creditModal) return;
    const amount = parseInt(creditAmount, 10);
    if (isNaN(amount) || amount === 0) return;

    setCreditSubmitting(true);
    setCreditMessage(null);

    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brokerId: creditModal.brokerId,
          amount,
          reason: creditReason,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Update the user list with new credit count
        setUsers((prev) =>
          prev.map((u) =>
            u.broker?.id === creditModal.brokerId
              ? { ...u, broker: { ...u.broker!, responseCredits: data.responseCredits } }
              : u
          )
        );
        setCreditMessage({
          text: t("admin.creditsAdjusted", "Credits adjusted successfully. New balance: {{count}}").replace("{{count}}", String(data.responseCredits)),
          ok: true,
        });
        setCreditAmount("");
        setCreditReason("");
        setTimeout(() => {
          setCreditModal(null);
          setCreditMessage(null);
        }, 1500);
      } else {
        setCreditMessage({ text: data.error, ok: false });
      }
    } catch {
      setCreditMessage({ text: "Failed to adjust credits", ok: false });
    } finally {
      setCreditSubmitting(false);
    }
  };

  const handleInviteAdmin = async () => {
    if (!inviteName || !inviteEmail || !invitePassword) return;
    setInviteSubmitting(true);
    setInviteMessage(null);

    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: inviteName, email: inviteEmail, password: invitePassword }),
      });

      const data = await res.json();

      if (res.ok) {
        setInviteMessage({ text: t("admin.adminCreated", "Admin account created successfully"), ok: true });
        // Refresh the current page to include the new user
        fetchUsers();
        setInviteName("");
        setInviteEmail("");
        setInvitePassword("");
        setTimeout(() => {
          setInviteModal(false);
          setInviteMessage(null);
        }, 1500);
      } else {
        setInviteMessage({ text: data.error, ok: false });
      }
    } catch {
      setInviteMessage({ text: "Failed to create admin", ok: false });
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleSendNotice = async () => {
    if (!noticeModal || !noticeSubject || !noticeBody) return;
    setNoticeSubmitting(true);
    setNoticeMessage(null);

    try {
      const res = await fetch("/api/admin/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: noticeModal.userId, subject: noticeSubject, body: noticeBody }),
      });

      if (res.ok) {
        setNoticeMessage({ text: t("admin.noticeSent", "Notice sent successfully"), ok: true });
        setNoticeSubject("");
        setNoticeBody("");
        setTimeout(() => {
          setNoticeModal(null);
          setNoticeMessage(null);
        }, 1500);
      } else {
        const data = await res.json();
        setNoticeMessage({ text: data.error, ok: false });
      }
    } catch {
      setNoticeMessage({ text: "Failed to send notice", ok: false });
    } finally {
      setNoticeSubmitting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const nonAdminUsers = users.filter((u) => u.role !== "ADMIN");
    if (selectedIds.size === nonAdminUsers.length && nonAdminUsers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(nonAdminUsers.map((u) => u.id)));
    }
  };

  const handleBulkStatus = async (newStatus: string) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/admin/users/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }).then((r) => r.json().then((d) => ({ ok: r.ok, data: d, id })))
      )
    );

    results.forEach((r) => {
      if (r.status === "fulfilled" && r.value.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === r.value.id ? { ...u, status: r.value.data.status } : u))
        );
      }
    });

    setSelectedIds(new Set());
    setBulkLoading(false);
  };

  const handleExportCSV = async () => {
    try {
      const res = await fetch("/api/admin/users?limit=10000");
      if (!res.ok) return;
      const json = await res.json();
      const allUsers: UserRow[] = json.data ?? json;
      const headers = ["Public ID", "Name", "Email", "Role", "Status", "Joined", "Brokerage", "Tier", "Credits", "Requests", "Conversations"];
      const rows = allUsers.map((u) => [
        u.publicId,
        u.name || "",
        u.email,
        u.role,
        u.status,
        new Date(u.createdAt).toISOString().slice(0, 10),
        u.broker?.brokerageName || "",
        u.broker?.subscriptionTier || "",
        u.broker ? String(u.broker.responseCredits) : "",
        String(u._count.borrowerRequests),
        String(u._count.conversations),
      ]);
      downloadCSV("users_export", headers, rows);
    } catch {
      // Export failed silently
    }
  };

  if (status === "loading" || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">{t("admin.loadingUsers", "Loading users...")}</p>
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
            <h1 className="heading-lg">{t("admin.userManagement", "User Management")}</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportCSV}
                className="btn-secondary !rounded-lg"
              >
                {t("admin.exportCsv", "Export CSV")}
              </button>
              <button
                onClick={() => setInviteModal(true)}
                className="btn-primary !rounded-lg"
              >
                {t("admin.inviteAdmin", "Invite Admin")}
              </button>
            </div>
          </div>
          <p className="text-body mt-2">
            {t("admin.userManagementDesc", "Search, view, and manage all users on the platform.")}
          </p>
        </div>

        {/* Search & Filters */}
        <div className="card-elevated mb-8 animate-fade-in-up stagger-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="search" className="label-text">
                {t("admin.searchUsers", "Search users")}
              </label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sage-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  id="search"
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t("admin.searchPlaceholder", "Search by name, email, or ID...")}
                  className="input-field !pl-10"
                />
              </div>
            </div>
            <div>
              <label htmlFor="roleFilter" className="label-text">
                {t("admin.filterByRole", "Filter by role")}
              </label>
              <select
                id="roleFilter"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="input-field w-auto min-w-[140px]"
              >
                <option value="ALL">{t("admin.allRoles", "All Roles")}</option>
                <option value="BORROWER">{t("admin.borrowers", "Borrowers")}</option>
                <option value="BROKER">{t("admin.brokersLabel", "Brokers")}</option>
                <option value="ADMIN">{t("admin.admins", "Admins")}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results count & bulk actions */}
        <div className="flex items-center justify-between mb-4 animate-fade-in">
          <p className="text-body-sm">
            {t("admin.showingUsers", "Showing {{count}} user(s)").replace("{{count}}", String(pagination.total))}
          </p>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="font-body text-sm text-forest-700 font-medium">
                {selectedIds.size} {t("admin.selected", "selected")}
              </span>
              <button
                onClick={() => handleBulkStatus("SUSPENDED")}
                disabled={bulkLoading}
                className="inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 font-body text-xs font-semibold text-white transition-all hover:bg-amber-700 disabled:opacity-50"
              >
                {bulkLoading ? "..." : t("admin.bulkSuspend", "Suspend All")}
              </button>
              <button
                onClick={() => handleBulkStatus("BANNED")}
                disabled={bulkLoading}
                className="inline-flex items-center rounded-lg bg-rose-600 px-3 py-1.5 font-body text-xs font-semibold text-white transition-all hover:bg-rose-700 disabled:opacity-50"
              >
                {bulkLoading ? "..." : t("admin.bulkBan", "Ban All")}
              </button>
              <button
                onClick={() => handleBulkStatus("ACTIVE")}
                disabled={bulkLoading}
                className="btn-primary !px-3 !py-1.5 !text-xs !rounded-lg disabled:opacity-50"
              >
                {bulkLoading ? "..." : t("admin.bulkReactivate", "Reactivate All")}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="font-body text-xs text-forest-700/50 hover:text-forest-700 transition-colors"
              >
                {t("admin.clearSelection", "Clear")}
              </button>
            </div>
          )}
        </div>

        {/* User Table */}
        <div className="card-elevated !p-0 overflow-hidden animate-fade-in-up stagger-2">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-cream-200">
              <thead>
                <tr className="bg-forest-800">
                  <th className="px-3 py-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === users.filter((u) => u.role !== "ADMIN").length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-cream-300 text-forest-600 focus:ring-forest-500"
                    />
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.user", "User")}
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.userId", "User ID")}
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.role", "Role")}
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.accountStatus", "Status")}
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.details", "Details")}
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.joined", "Joined")}
                  </th>
                  <th className="px-5 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200 bg-white">
                {users.map((user) => (
                  <tr key={user.id} className={`transition-colors ${user.status !== "ACTIVE" ? "bg-rose-50/30" : "hover:bg-cream-50"}`}>
                    {/* Checkbox */}
                    <td className="px-3 py-4">
                      {user.role !== "ADMIN" ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(user.id)}
                          onChange={() => toggleSelect(user.id)}
                          className="h-4 w-4 rounded border-cream-300 text-forest-600 focus:ring-forest-500"
                        />
                      ) : (
                        <span className="block h-4 w-4" />
                      )}
                    </td>
                    {/* Name & Email */}
                    <td className="px-5 py-4">
                      <div>
                        <p className={`font-body text-sm font-semibold ${user.status !== "ACTIVE" ? "text-forest-800/50 line-through" : "text-forest-800"}`}>
                          {user.name || "—"}
                        </p>
                        <p className="font-body text-xs text-forest-700/60">{user.email}</p>
                      </div>
                    </td>

                    {/* User ID */}
                    <td className="px-5 py-4">
                      <button
                        onClick={() => copyId(user.publicId)}
                        className="group inline-flex items-center gap-1.5 rounded-md bg-cream-100 px-2 py-1 font-mono text-xs text-forest-700/70 transition-colors hover:bg-cream-200"
                        title="Click to copy"
                      >
                        <span>{user.publicId}</span>
                        {copiedId === user.publicId ? (
                          <svg className="h-3.5 w-3.5 text-forest-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        ) : (
                          <svg className="h-3.5 w-3.5 text-sage-400 group-hover:text-forest-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                          </svg>
                        )}
                      </button>
                    </td>

                    {/* Role */}
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide ${ROLE_BADGE[user.role]}`}>
                        {user.role}
                      </span>
                    </td>

                    {/* Account Status */}
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide ${STATUS_BADGE[user.status] || STATUS_BADGE.ACTIVE}`}>
                        {user.status}
                      </span>
                      {actionMessage?.id === user.id && (
                        <p className={`mt-1 font-body text-[10px] ${actionMessage.ok ? "text-forest-600" : "text-rose-600"}`}>
                          {actionMessage.text}
                        </p>
                      )}
                    </td>

                    {/* Details */}
                    <td className="px-5 py-4">
                      {user.role === "BROKER" && user.broker ? (
                        <div className="space-y-1">
                          <p className="font-body text-xs text-forest-700/70">
                            {user.broker.brokerageName}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-body text-[10px] font-semibold ${TIER_BADGE[user.broker.subscriptionTier] || TIER_BADGE.FREE}`}>
                              {user.broker.subscriptionTier}
                            </span>
                            <span className="font-body text-[10px] text-forest-700/50">
                              {user.broker.responseCredits} {t("admin.creditsShort", "cr.")}
                            </span>
                          </div>
                        </div>
                      ) : user.role === "BORROWER" ? (
                        <div className="space-y-0.5">
                          <p className="font-body text-xs text-forest-700/70">
                            {user._count.borrowerRequests} {t("admin.requests", "request(s)")}
                          </p>
                          <p className="font-body text-xs text-forest-700/50">
                            {user._count.conversations} {t("admin.convos", "conversation(s)")}
                          </p>
                        </div>
                      ) : (
                        <span className="font-body text-xs text-sage-400">—</span>
                      )}
                    </td>

                    {/* Joined */}
                    <td className="whitespace-nowrap px-5 py-4 font-body text-sm text-forest-700/70">
                      {formatDate(user.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {user.role === "BROKER" && user.broker && (
                          <>
                            <Link
                              href={`/admin/brokers/${user.broker.id}`}
                              className="btn-secondary !px-3 !py-1.5 !text-xs !rounded-lg"
                            >
                              {t("admin.viewBroker", "View Broker")}
                            </Link>
                            <button
                              onClick={() =>
                                setCreditModal({
                                  brokerId: user.broker!.id,
                                  brokerName: user.name || user.email,
                                  currentCredits: user.broker!.responseCredits,
                                })
                              }
                              className="btn-secondary !px-3 !py-1.5 !text-xs !rounded-lg"
                            >
                              {t("admin.adjustCredits", "Credits")}
                            </button>
                          </>
                        )}
                        {user.role !== "ADMIN" && (
                          <>
                            <button
                              onClick={() => setNoticeModal({ userId: user.id, userName: user.name || user.email })}
                              className="btn-secondary !px-3 !py-1.5 !text-xs !rounded-lg"
                            >
                              {t("admin.sendNotice", "Notice")}
                            </button>
                            {user.status === "ACTIVE" && (
                              <button
                                onClick={() => handleStatusChange(user.id, "SUSPENDED")}
                                disabled={actionLoading === user.id}
                                className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-3 py-1.5 font-body text-xs font-semibold text-white transition-all hover:bg-amber-700 active:scale-[0.98] disabled:opacity-50"
                              >
                                {actionLoading === user.id ? "..." : t("admin.suspendUser", "Suspend")}
                              </button>
                            )}
                            {user.status === "ACTIVE" && (
                              <button
                                onClick={() => handleStatusChange(user.id, "BANNED")}
                                disabled={actionLoading === user.id}
                                className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-3 py-1.5 font-body text-xs font-semibold text-white transition-all hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
                              >
                                {actionLoading === user.id ? "..." : t("admin.banUser", "Ban")}
                              </button>
                            )}
                            {user.status !== "ACTIVE" && (
                              <button
                                onClick={() => handleStatusChange(user.id, "ACTIVE")}
                                disabled={actionLoading === user.id}
                                className="btn-primary !px-3 !py-1.5 !text-xs !rounded-lg disabled:opacity-50"
                              >
                                {actionLoading === user.id ? "..." : t("admin.reactivate", "Reactivate")}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-body-sm">
                      {t("admin.noUsersFound", "No users found matching your search.")}
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

      {/* Credit Adjustment Modal */}
      {creditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-forest-900/50 backdrop-blur-sm"
            onClick={() => { if (!creditSubmitting) { setCreditModal(null); setCreditMessage(null); } }}
          />
          <div className="relative w-full max-w-md animate-fade-in-up rounded-2xl bg-white p-8 shadow-2xl">
            <button
              onClick={() => { if (!creditSubmitting) { setCreditModal(null); setCreditMessage(null); } }}
              className="absolute right-4 top-4 rounded-lg p-1 text-sage-400 transition-colors hover:text-forest-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="heading-md mb-1">{t("admin.adjustCreditsTitle", "Adjust Credits")}</h3>
            <p className="text-body-sm mb-2">{creditModal.brokerName}</p>
            <p className="font-body text-sm text-forest-700 mb-6">
              {t("admin.currentBalance", "Current balance:")}{" "}
              <span className="font-semibold text-amber-700">{creditModal.currentCredits}</span>
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="creditAmount" className="label-text">
                  {t("admin.creditAmount", "Amount")}
                </label>
                <input
                  id="creditAmount"
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder={t("admin.creditAmountPlaceholder", "e.g. 5 to add, -3 to remove")}
                  className="input-field"
                />
                <p className="mt-1 font-body text-xs text-forest-700/50">
                  {t("admin.creditAmountHint", "Use positive numbers to add, negative to remove.")}
                </p>
              </div>

              <div>
                <label htmlFor="creditReason" className="label-text">
                  {t("admin.reason", "Reason")}
                </label>
                <input
                  id="creditReason"
                  type="text"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  placeholder={t("admin.reasonPlaceholder", "e.g. Refund for spam request")}
                  className="input-field"
                />
              </div>

              <button
                onClick={handleCreditAdjust}
                disabled={creditSubmitting || !creditAmount || parseInt(creditAmount, 10) === 0}
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creditSubmitting
                  ? t("admin.adjusting", "Adjusting...")
                  : t("admin.confirmAdjust", "Confirm Adjustment")}
              </button>
            </div>

            {creditMessage && (
              <div className={`mt-4 rounded-lg p-3 text-center font-body text-sm ${creditMessage.ok ? "bg-forest-50 text-forest-700" : "bg-red-50 text-red-700"}`}>
                {creditMessage.text}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite Admin Modal */}
      {inviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-forest-900/50 backdrop-blur-sm"
            onClick={() => { if (!inviteSubmitting) { setInviteModal(false); setInviteMessage(null); } }}
          />
          <div className="relative w-full max-w-md animate-fade-in-up rounded-2xl bg-white p-8 shadow-2xl">
            <button
              onClick={() => { if (!inviteSubmitting) { setInviteModal(false); setInviteMessage(null); } }}
              className="absolute right-4 top-4 rounded-lg p-1 text-sage-400 transition-colors hover:text-forest-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="heading-md mb-1">{t("admin.inviteAdmin", "Invite Admin")}</h3>
            <p className="text-body-sm mb-6">
              {t("admin.inviteAdminDesc", "Create a new admin account. The user will be able to log in immediately.")}
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="inviteName" className="label-text">{t("auth.name")}</label>
                <input
                  id="inviteName"
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="inviteEmail" className="label-text">{t("auth.email")}</label>
                <input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="invitePassword" className="label-text">{t("auth.password")}</label>
                <input
                  id="invitePassword"
                  type="password"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder={t("settings.minChars", "At least 8 characters")}
                  className="input-field"
                />
              </div>

              <button
                onClick={handleInviteAdmin}
                disabled={inviteSubmitting || !inviteName || !inviteEmail || invitePassword.length < 8}
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {inviteSubmitting
                  ? t("admin.creating", "Creating...")
                  : t("admin.createAdmin", "Create Admin Account")}
              </button>
            </div>

            {inviteMessage && (
              <div className={`mt-4 rounded-lg p-3 text-center font-body text-sm ${inviteMessage.ok ? "bg-forest-50 text-forest-700" : "bg-red-50 text-red-700"}`}>
                {inviteMessage.text}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Send Notice Modal */}
      {noticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-forest-900/50 backdrop-blur-sm"
            onClick={() => { if (!noticeSubmitting) { setNoticeModal(null); setNoticeMessage(null); } }}
          />
          <div className="relative w-full max-w-md animate-fade-in-up rounded-2xl bg-white p-8 shadow-2xl">
            <button
              onClick={() => { if (!noticeSubmitting) { setNoticeModal(null); setNoticeMessage(null); } }}
              className="absolute right-4 top-4 rounded-lg p-1 text-sage-400 transition-colors hover:text-forest-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="heading-md mb-1">{t("admin.sendNoticeTo", "Send Notice")}</h3>
            <p className="text-body-sm mb-6">
              {t("admin.sendNoticeDesc", "Send a direct notice to")} {noticeModal.userName}
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="noticeSubject" className="label-text">{t("admin.noticeSubject", "Subject")}</label>
                <input
                  id="noticeSubject"
                  type="text"
                  value={noticeSubject}
                  onChange={(e) => setNoticeSubject(e.target.value)}
                  placeholder={t("admin.noticeSubjectPlaceholder", "e.g. Account update")}
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="noticeBody" className="label-text">{t("admin.noticeBody", "Message")}</label>
                <textarea
                  id="noticeBody"
                  value={noticeBody}
                  onChange={(e) => setNoticeBody(e.target.value)}
                  rows={4}
                  placeholder={t("admin.noticeBodyPlaceholder", "Write your message...")}
                  className="input-field resize-none"
                />
              </div>

              <button
                onClick={handleSendNotice}
                disabled={noticeSubmitting || !noticeSubject || !noticeBody}
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {noticeSubmitting
                  ? t("admin.sending", "Sending...")
                  : t("admin.sendNoticeBtn", "Send Notice")}
              </button>
            </div>

            {noticeMessage && (
              <div className={`mt-4 rounded-lg p-3 text-center font-body text-sm ${noticeMessage.ok ? "bg-forest-50 text-forest-700" : "bg-red-50 text-red-700"}`}>
                {noticeMessage.text}
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
