import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import Layout from "@/components/Layout";

interface UserRow {
  id: string;
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
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");
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

  // Fetch all users once on mount
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/login", undefined, { locale: router.locale });
      return;
    }

    const fetchAllUsers = async () => {
      try {
        const res = await fetch("/api/admin/users");
        if (res.ok) {
          setAllUsers(await res.json());
        }
      } catch {
        // Network error
      } finally {
        setLoading(false);
      }
    };

    fetchAllUsers();
  }, [session, status, router]);

  // Client-side filtering
  const users = useMemo(() => {
    let filtered = allUsers;

    if (filterRole !== "ALL") {
      filtered = filtered.filter((u) => u.role === filterRole);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (u) =>
          (u.name || "").toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [allUsers, filterRole, searchQuery]);

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
        setAllUsers((prev) =>
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
        setAllUsers((prev) =>
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
          <h1 className="heading-lg">{t("admin.userManagement", "User Management")}</h1>
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("admin.searchPlaceholder", "Search by name, email, or user ID...")}
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

        {/* Results count */}
        <p className="text-body-sm mb-4 animate-fade-in">
          {t("admin.showingUsers", "Showing {{count}} user(s)").replace("{{count}}", String(users.length))}
        </p>

        {/* User Table */}
        <div className="card-elevated !p-0 overflow-hidden animate-fade-in-up stagger-2">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-cream-200">
              <thead>
                <tr className="bg-forest-800">
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
                        onClick={() => copyId(user.id)}
                        className="group inline-flex items-center gap-1.5 rounded-md bg-cream-100 px-2 py-1 font-mono text-xs text-forest-700/70 transition-colors hover:bg-cream-200"
                        title="Click to copy"
                      >
                        <span className="max-w-[100px] truncate">{user.id}</span>
                        {copiedId === user.id ? (
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
                    <td colSpan={7} className="px-5 py-12 text-center text-body-sm">
                      {t("admin.noUsersFound", "No users found matching your search.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});
