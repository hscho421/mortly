import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import nextI18NextConfig from "@/next-i18next.config.js";
import type { GetServerSideProps } from "next";
import Layout from "@/components/Layout";
import { getRequestTitle } from "@/lib/requestConfig";

interface MessageItem {
  id: string;
  body: string;
  createdAt: string;
  sender: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
}

interface ConversationDetail {
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
    requestType?: string | null;
    province: string;
    city: string | null;
    status: string;
    mortgageCategory?: string | null;
    schemaVersion?: number | null;
  };
  messages: MessageItem[];
}

const ROLE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  BORROWER: { bg: "bg-sage-100", text: "text-sage-700", label: "Borrower" },
  BROKER: { bg: "bg-forest-100", text: "text-forest-700", label: "Broker" },
  ADMIN: { bg: "bg-amber-100", text: "text-amber-800", label: "Admin" },
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminConversationDetail() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const { t } = useTranslation("common");
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Close modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState("");

  useEffect(() => {
    if (status === "loading" || !id) return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/login", undefined, { locale: router.locale });
      return;
    }

    const fetchConversation = async () => {
      try {
        const res = await fetch(`/api/admin/conversations/${id}`);
        if (res.ok) {
          setConversation(await res.json());
        } else {
          setError("Conversation not found");
        }
      } catch {
        setError("Failed to load conversation");
      } finally {
        setLoading(false);
      }
    };

    fetchConversation();
  }, [session, status, router, id]);

  const handleClose = async () => {
    if (!conversation) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/admin/conversations/${conversation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED", reason: closeReason }),
      });

      if (res.ok) {
        // Re-fetch to get the admin closure message
        const refreshRes = await fetch(`/api/admin/conversations/${conversation.id}`);
        if (refreshRes.ok) {
          setConversation(await refreshRes.json());
        }
        setShowCloseModal(false);
        setCloseReason("");
      }
    } catch {
      // error
    } finally {
      setActionLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">{t("admin.loadingConversation", "Loading conversation...")}</p>
        </div>
      </Layout>
    );
  }

  if (error || !conversation) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-10 text-center">
          <p className="text-body-sm text-rose-600">{error || "Conversation not found"}</p>
          <Link href="/admin/conversations" className="btn-secondary mt-4 inline-block">
            {t("admin.backToConversations", "Back to Conversations")}
          </Link>
        </div>
      </Layout>
    );
  }

  if (!session || session.user.role !== "ADMIN") return null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <Link
            href="/admin/conversations"
            className="mb-4 inline-flex items-center gap-1 font-body text-sm font-medium text-forest-600 hover:text-forest-800 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            {t("admin.backToConversations", "Back to Conversations")}
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="heading-lg">{t("admin.conversationDetail", "Conversation Detail")}</h1>
              <p className="font-mono text-xs text-forest-700/50 mt-1">ID: {conversation.publicId}</p>
            </div>
            {conversation.status === "ACTIVE" && (
              <button
                onClick={() => setShowCloseModal(true)}
                className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-5 py-2.5 font-body text-sm font-semibold text-white transition-all hover:bg-rose-700 active:scale-[0.98]"
              >
                {t("admin.closeConversation", "Close Conversation")}
              </button>
            )}
          </div>
        </div>

        {/* Conversation Info Card */}
        <div className="card-elevated mb-8 animate-fade-in-up stagger-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Borrower */}
            <div>
              <p className="label-text mb-1">{t("admin.borrowerLabel", "Borrower")}</p>
              <p className="font-body text-sm font-semibold text-forest-800">{conversation.borrower.name || "—"}</p>
              <p className="font-body text-xs text-forest-700/60">{conversation.borrower.email}</p>
              {conversation.borrower.status !== "ACTIVE" && (
                <span className="mt-1 inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 font-body text-[10px] font-semibold text-rose-700">
                  {conversation.borrower.status}
                </span>
              )}
            </div>

            {/* Broker */}
            <div>
              <p className="label-text mb-1">{t("admin.brokerLabel", "Broker")}</p>
              <p className="font-body text-sm font-semibold text-forest-800">{conversation.broker.user.name || "—"}</p>
              <p className="font-body text-xs text-forest-700/60">{conversation.broker.brokerageName}</p>
              <p className="font-body text-xs text-forest-700/60">{conversation.broker.user.email}</p>
              {conversation.broker.user.status !== "ACTIVE" && (
                <span className="mt-1 inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 font-body text-[10px] font-semibold text-rose-700">
                  {conversation.broker.user.status}
                </span>
              )}
            </div>

            {/* Request & Meta */}
            <div>
              <p className="label-text mb-1">{t("admin.relatedRequest", "Related Request")}</p>
              <p className="font-body text-sm text-forest-800">
                {getRequestTitle(conversation.request)} · {conversation.request.province}
                {conversation.request.city ? `, ${conversation.request.city}` : ""}
              </p>
              <p className="font-body text-xs text-forest-700/50 mt-1">
                Request: <span className={conversation.request.status === "OPEN" ? "text-forest-600" : "text-sage-500"}>{conversation.request.status}</span>
              </p>
              <p className="font-body text-xs text-forest-700/50">
                Conversation: <span className={conversation.status === "ACTIVE" ? "text-forest-600" : "text-sage-500"}>{conversation.status}</span>
              </p>
              <p className="font-body text-xs text-forest-700/40 mt-1">
                {t("admin.started", "Started")}: {formatDate(conversation.createdAt)}
              </p>
            </div>
          </div>

        </div>

        {/* Chat Messages */}
        <div className="animate-fade-in-up stagger-2">
          <h2 className="heading-sm mb-4">
            {t("admin.messageThread", "Message Thread")} ({conversation.messages.length})
          </h2>

          {conversation.messages.length === 0 ? (
            <div className="card-elevated py-12 text-center">
              <p className="text-body-sm">{t("admin.noMessages", "No messages in this conversation.")}</p>
            </div>
          ) : (
            <div className="card-elevated !p-0 overflow-hidden">
              {/* Chat container */}
              <div className="bg-cream-50 px-4 py-6 space-y-4 max-h-[600px] overflow-y-auto">
                {conversation.messages.map((msg) => {
                  const roleInfo = ROLE_COLORS[msg.sender.role] || ROLE_COLORS.BORROWER;
                  const isBorrower = msg.sender.role === "BORROWER";
                  const isBroker = msg.sender.role === "BROKER";
                  const isAdmin = msg.sender.role === "ADMIN";

                  // Admin messages: centered system-style
                  if (isAdmin) {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <div className="max-w-[85%] rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-center">
                          <p className="font-body text-xs font-semibold text-amber-700 mb-1">
                            {msg.sender.name || "Admin"}
                          </p>
                          <p className="font-body text-sm text-amber-800 whitespace-pre-wrap break-words">
                            {msg.body}
                          </p>
                          <p className="font-body text-[10px] text-amber-600/60 mt-1.5">
                            {formatDateTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  // Borrower: left-aligned, Broker: right-aligned
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isBroker ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[75%] ${isBroker ? "order-2" : ""}`}>
                        {/* Sender label */}
                        <div className={`flex items-center gap-1.5 mb-1 ${isBroker ? "justify-end" : ""}`}>
                          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-body text-[9px] font-semibold uppercase ${roleInfo.bg} ${roleInfo.text}`}>
                            {isBorrower ? "B" : "K"}
                          </span>
                          <span className="font-body text-[11px] font-medium text-forest-700/60">
                            {msg.sender.name || msg.sender.email}
                          </span>
                        </div>

                        {/* Bubble */}
                        <div
                          className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                            isBorrower
                              ? "bg-white border border-cream-200 rounded-tl-md"
                              : "bg-forest-600 text-white rounded-tr-md"
                          }`}
                        >
                          <p className={`font-body text-sm whitespace-pre-wrap break-words ${
                            isBorrower ? "text-forest-800" : "text-white"
                          }`}>
                            {msg.body}
                          </p>
                        </div>

                        {/* Timestamp */}
                        <p className={`font-body text-[10px] text-forest-700/40 mt-1 ${isBroker ? "text-right" : ""}`}>
                          {formatDateTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Close Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-forest-900/50 backdrop-blur-sm" onClick={() => setShowCloseModal(false)} />
          <div className="relative w-full max-w-md animate-fade-in-up rounded-2xl bg-white p-8 shadow-2xl">
            <button
              onClick={() => setShowCloseModal(false)}
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
                <label htmlFor="closeReasonDetail" className="label-text">{t("admin.reason")}</label>
                <input
                  id="closeReasonDetail"
                  type="text"
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder={t("admin.closeReasonPlaceholder", "e.g. Abusive language, spam")}
                  className="input-field"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowCloseModal(false)} className="btn-secondary flex-1">
                  {t("common.cancel", "Cancel")}
                </button>
                <button
                  onClick={handleClose}
                  disabled={actionLoading}
                  className="flex-1 inline-flex items-center justify-center rounded-xl bg-rose-600 px-6 py-3 font-body text-sm font-semibold text-white transition-all hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading ? "..." : t("admin.confirmClose", "Close Conversation")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"], nextI18NextConfig)),
  },
});
