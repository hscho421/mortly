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
import { getRequestTitle } from "@/lib/requestConfig";

interface ConversationRow {
  id: string;
  publicId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  borrower: {
    id: string;
    name: string | null;
    email: string;
    status: string;
  };
  broker: {
    id: string;
    brokerageName: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      status: string;
    };
  };
  request: {
    id: string;
    province: string;
    city: string | null;
    status: string;
    mortgageCategory?: string | null;
    productTypes?: string[] | null;
  };
  _count: { messages: number };
  messages: Array<{
    body: string;
    createdAt: string;
    sender: { name: string | null };
  }>;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-forest-100 text-forest-700",
  CLOSED: "bg-sage-200 text-sage-700",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminConversations() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  // Close conversation modal
  const [closeModal, setCloseModal] = useState<{ id: string } | null>(null);
  const [closeReason, setCloseReason] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page to 1 when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterStatus]);

  const fetchConversations = useCallback(async () => {
    if (!session || session.user.role !== "ADMIN") return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        search: debouncedSearch,
        status: filterStatus,
      });
      const res = await fetch(`/api/admin/conversations?${params}`);
      if (res.ok) {
        const json = await res.json();
        setConversations(json.data);
        setPagination(json.pagination);
      }
    } catch {
      // Network error
    } finally {
      setLoading(false);
    }
  }, [session, page, debouncedSearch, filterStatus]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") return;
    fetchConversations();
  }, [session, status, router, fetchConversations]);

  const handleClose = async () => {
    if (!closeModal) return;
    setActionLoading(closeModal.id);

    try {
      const res = await fetch(`/api/admin/conversations/${closeModal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED", reason: closeReason }),
      });

      if (res.ok) {
        setActionMessage({ id: closeModal.id, text: t("admin.conversationClosed", "Conversation closed"), ok: true });
        setCloseModal(null);
        setCloseReason("");
        fetchConversations();
      } else {
        const data = await res.json();
        setActionMessage({ id: closeModal.id, text: data.error, ok: false });
      }
    } catch {
      setActionMessage({ id: closeModal.id, text: t("admin.failedToClose", "Failed to close"), ok: false });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  if (status === "loading" || loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">{t("admin.loadingConversations", "Loading conversations...")}</p>
        </div>
      </AdminLayout>
    );
  }

  if (!session || session.user.role !== "ADMIN") return null;

  return (
    <AdminLayout>
      <Head><title>{t("titles.adminConversations")}</title></Head>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="heading-lg">{t("admin.conversationOversight", "Conversation Oversight")}</h1>
          <p className="text-body mt-2">
            {t("admin.conversationOversightDesc", "Monitor all conversations between borrowers and brokers. View messages and close abusive threads.")}
          </p>
        </div>

        {/* Filters */}
        <div className="card-elevated mb-8 animate-fade-in-up stagger-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="searchConvo" className="label-text">
                {t("admin.searchConversations", "Search conversations")}
              </label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sage-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  id="searchConvo"
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t("admin.searchConversationsPlaceholder", "Search by participant name, email, or brokerage...")}
                  className="input-field !pl-10"
                />
              </div>
            </div>
            <div>
              <label htmlFor="convoStatusFilter" className="label-text">
                {t("admin.filterByStatus")}
              </label>
              <select
                id="convoStatusFilter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input-field w-auto min-w-[140px]"
              >
                <option value="ALL">{t("admin.allStatuses")}</option>
                <option value="ACTIVE">{t("status.active")}</option>
                <option value="CLOSED">{t("status.closed")}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results count */}
        <p className="text-body-sm mb-4 animate-fade-in">
          {t("admin.showingConversations", "Showing {{count}} conversation(s)").replace("{{count}}", String(pagination.total))}
        </p>

        {/* Conversations Table */}
        <div className="card-elevated !p-0 overflow-hidden animate-fade-in-up stagger-2">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-cream-200">
              <thead>
                <tr className="bg-forest-800">
                  <th className="px-4 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    ID
                  </th>
                  <th className="px-4 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.participants", "Participants")}
                  </th>
                  <th className="px-4 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.relatedRequest", "Request")}
                  </th>
                  <th className="px-4 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.statusLabel", "Status")}
                  </th>
                  <th className="px-4 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.messagesCount", "Messages")}
                  </th>
                  <th className="px-4 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.lastMessage", "Last Message")}
                  </th>
                  <th className="px-4 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.created", "Created")}
                  </th>
                  <th className="px-4 py-3.5 text-left font-body text-xs font-semibold uppercase tracking-wider text-cream-100">
                    {t("admin.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200 bg-white">
                {conversations.map((convo) => {
                  const lastMsg = convo.messages[0];
                  return (
                    <tr key={convo.id} className="hover:bg-cream-50 transition-colors">
                      {/* Conversation ID */}
                      <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-forest-700/70">
                        {convo.publicId}
                      </td>

                      {/* Participants */}
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <div>
                            <span className="inline-flex items-center rounded-full bg-sage-100 px-1.5 py-0.5 font-body text-[9px] font-semibold uppercase text-sage-700 mr-1">B</span>
                            <span className="font-body text-sm font-semibold text-forest-800">{convo.borrower.name || "—"}</span>
                            {convo.borrower.status !== "ACTIVE" && (
                              <span className="ml-1 inline-flex items-center rounded-full bg-rose-100 px-1.5 py-0.5 font-body text-[9px] font-semibold text-rose-700">{convo.borrower.status}</span>
                            )}
                          </div>
                          <div>
                            <span className="inline-flex items-center rounded-full bg-forest-100 px-1.5 py-0.5 font-body text-[9px] font-semibold uppercase text-forest-700 mr-1">K</span>
                            <span className="font-body text-sm text-forest-800">{convo.broker.user.name || convo.broker.brokerageName}</span>
                            {convo.broker.user.status !== "ACTIVE" && (
                              <span className="ml-1 inline-flex items-center rounded-full bg-rose-100 px-1.5 py-0.5 font-body text-[9px] font-semibold text-rose-700">{convo.broker.user.status}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Related Request */}
                      <td className="px-4 py-4">
                        <p className="font-body text-sm text-forest-800">{getRequestTitle(convo.request)}</p>
                        <p className="font-body text-[10px] text-forest-700/50">
                          {convo.request.province}{convo.request.city ? `, ${convo.request.city}` : ""} ·{" "}
                          <span className={convo.request.status === "OPEN" ? "text-forest-600" : "text-sage-500"}>{convo.request.status}</span>
                        </p>
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide ${STATUS_BADGE[convo.status]}`}>
                          {convo.status}
                        </span>
                        {actionMessage?.id === convo.id && (
                          <p className={`mt-1 font-body text-[10px] ${actionMessage.ok ? "text-forest-600" : "text-rose-600"}`}>
                            {actionMessage.text}
                          </p>
                        )}
                      </td>

                      {/* Messages */}
                      <td className="whitespace-nowrap px-4 py-4 font-body text-sm text-forest-700/80">
                        {convo._count.messages}
                      </td>

                      {/* Last Message */}
                      <td className="px-4 py-4 max-w-[200px]">
                        {lastMsg ? (
                          <div>
                            <p className="font-body text-xs text-forest-700/80 truncate">{lastMsg.body}</p>
                            <p className="font-body text-[10px] text-forest-700/40">
                              {lastMsg.sender.name || "Unknown"} · {formatDateTime(lastMsg.createdAt)}
                            </p>
                          </div>
                        ) : (
                          <span className="font-body text-xs text-sage-400">—</span>
                        )}
                      </td>

                      {/* Created */}
                      <td className="whitespace-nowrap px-4 py-4 font-body text-sm text-forest-700/70">
                        {formatDate(convo.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap px-4 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/admin/conversations/${convo.id}`}
                            className="btn-secondary !px-3 !py-1.5 !text-xs !rounded-lg"
                          >
                            {t("admin.viewMessages", "Messages")}
                          </Link>
                          {convo.status === "ACTIVE" && (
                            <button
                              onClick={() => {
                                setCloseModal({ id: convo.id });
                                setCloseReason("");
                              }}
                              className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-3 py-1.5 font-body text-xs font-semibold text-white transition-all hover:bg-rose-700 active:scale-[0.98]"
                            >
                              {t("admin.closeConversation", "Close")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {conversations.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-body-sm">
                      {t("admin.noConversationsFound", "No conversations found.")}
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

      {/* Close Conversation Modal */}
      {closeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-forest-900/50 backdrop-blur-sm" onClick={() => setCloseModal(null)} />
          <div className="relative w-full max-w-md animate-fade-in-up rounded-2xl bg-white p-8 shadow-2xl">
            <button
              onClick={() => setCloseModal(null)}
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
              <h3 className="heading-md">{t("admin.closeConversationTitle", "Close Conversation")}</h3>
            </div>

            <p className="text-body-sm mb-4">
              {t("admin.closeConversationWarning", "This will close the conversation and notify both participants. An admin closure message will be sent.")}
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="closeReason" className="label-text">{t("admin.reason")}</label>
                <input
                  id="closeReason"
                  type="text"
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder={t("admin.closeReasonPlaceholder", "e.g. Abusive language, spam")}
                  className="input-field"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setCloseModal(null)} className="btn-secondary flex-1">
                  {t("common.cancel", "Cancel")}
                </button>
                <button
                  onClick={handleClose}
                  disabled={actionLoading === closeModal.id}
                  className="flex-1 inline-flex items-center justify-center rounded-xl bg-rose-600 px-6 py-3 font-body text-sm font-semibold text-white transition-all hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading === closeModal.id ? "..." : t("admin.confirmClose", "Close Conversation")}
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
