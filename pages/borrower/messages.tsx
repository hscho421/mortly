import {
  useState,
  useEffect,
  useRef,
  useCallback,
  FormEvent,
} from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";
import type { ConversationWithParticipants } from "@/types";
import type { Message } from "@/types";

/* ────────────────────────────────────────────── */
/*  Types                                         */
/* ────────────────────────────────────────────── */

interface ConversationListItem {
  id: string;
  status: string;
  updatedAt: string;
  unreadCount?: number;
  messages: { body: string; createdAt: string; senderId: string }[];
  broker: {
    id: string;
    brokerageName: string;
    verificationStatus: string;
    user: { id: string; name: string | null; email: string };
  };
  borrower: { id: string; name: string | null; email: string };
  request: { id: string; requestType: string; province: string };
}

/* ────────────────────────────────────────────── */
/*  Helpers                                       */
/* ────────────────────────────────────────────── */

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function relativeTime(date: string) {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return formatDate(date);
}

function displayLabel(val: string) {
  return val
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ────────────────────────────────────────────── */
/*  Component                                     */
/* ────────────────────────────────────────────── */

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});

export default function BorrowerMessagesPage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  /* ---- state ---- */
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [conversation, setConversation] =
    useState<ConversationWithParticipants | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ---- auth guard ---- */
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace("/login", undefined, { locale: router.locale });
    }
  }, [authStatus, router]);

  /* ---- scroll helper ---- */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  /* ---- fetch conversation list ---- */
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error("Failed to load conversations");
      const data: ConversationListItem[] = await res.json();
      setConversations(data);
    } catch {
      setError("Failed to load conversations.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchConversations();
      // Poll for new messages / unread counts every 15 seconds
      const interval = setInterval(fetchConversations, 15000);
      return () => clearInterval(interval);
    }
  }, [authStatus, fetchConversations]);

  /* ---- fetch active conversation ---- */
  const fetchActiveConversation = useCallback(async (id: string) => {
    setChatLoading(true);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) throw new Error("Failed to load conversation");
      const data: ConversationWithParticipants = await res.json();
      setConversation(data);
      setMessages(data.messages);
    } catch {
      setError("Failed to load conversation.");
    } finally {
      setChatLoading(false);
    }
  }, []);

  /* ---- auto-select from query param (e.g. after accepting intro) ---- */
  useEffect(() => {
    const qid = router.query.id;
    if (typeof qid === "string" && qid && !activeId) {
      setActiveId(qid);
      fetchActiveConversation(qid);
      setMobileShowChat(true);
    }
  }, [router.query.id, activeId, fetchActiveConversation]);

  /* ---- Supabase Realtime for instant messages ---- */
  useEffect(() => {
    if (!activeId || authStatus !== "authenticated") return;

    const channel = supabase
      .channel(`chat-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversationId=eq.${activeId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Only add if we don't already have it (e.g. from optimistic update)
          setMessages((prev) =>
            prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]
          );
          // Refresh conversation list sidebar for latest preview
          fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${activeId}`,
        },
        (payload) => {
          const updated = payload.new as { status: string };
          if (updated.status === "CLOSED") {
            setConversation((prev) =>
              prev ? { ...prev, status: "CLOSED" } : prev
            );
            fetchConversations();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, authStatus, fetchConversations]);

  /* ---- auto-scroll on new messages ---- */
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /* ---- select conversation ---- */
  function selectConversation(id: string) {
    setActiveId(id);
    setMobileShowChat(true);
    fetchActiveConversation(id).then(() => {
      // Clear unread count locally for this conversation
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
      );
      // Tell Navbar to refresh its badge
      window.dispatchEvent(new Event("refresh-unread"));
    });
  }

  /* ---- send message ---- */
  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = newMessage.trim();
    if (!body || !activeId || sending) return;

    setSending(true);
    setNewMessage("");

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId, body }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to send message");
      }

      const sent: Message = await res.json();
      setMessages((prev) => [...prev, sent]);
      // refresh list to update preview
      fetchConversations();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send");
      setNewMessage(body);
    } finally {
      setSending(false);
    }
  }

  /* ---- close conversation ---- */
  async function handleCloseConversation() {
    if (!activeId) return;
    try {
      const res = await fetch(`/api/conversations/${activeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      if (!res.ok) throw new Error("Failed to close conversation");
      setShowCloseConfirm(false);
      // refresh both
      fetchActiveConversation(activeId);
      fetchConversations();
      // show review modal
      setReviewRating(0);
      setReviewHover(0);
      setReviewComment("");
      setShowReviewModal(true);
    } catch {
      setError("Failed to close conversation.");
      setShowCloseConfirm(false);
    }
  }

  /* ---- submit review ---- */
  async function handleSubmitReview() {
    if (!activeId || reviewRating === 0) return;
    setReviewSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeId,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to submit review");
      }
      setShowReviewModal(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit review");
      setShowReviewModal(false);
    } finally {
      setReviewSubmitting(false);
    }
  }

  /* ---- loading / auth states ---- */
  if (authStatus === "loading" || listLoading) {
    return (
      <>
        <Navbar />
        <div
          className="flex items-center justify-center"
          style={{ height: "calc(100vh - 80px)" }}
        >
          <p className="text-body-sm">Loading messages...</p>
        </div>
      </>
    );
  }

  if (!session) return null;

  const userId = session.user?.id;
  const isClosed = conversation?.status === "CLOSED";

  /* ---- group messages by date ---- */
  const groupedMessages: { date: string; items: Message[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const dateStr = formatDate(msg.createdAt as unknown as string);
    if (dateStr !== currentDate) {
      currentDate = dateStr;
      groupedMessages.push({ date: dateStr, items: [] });
    }
    groupedMessages[groupedMessages.length - 1].items.push(msg);
  }

  /* ────────────────────────────────────────────── */
  /*  Render                                        */
  /* ────────────────────────────────────────────── */

  return (
    <>
      <Navbar />

      {/* Confirmation dialog */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 backdrop-blur-sm animate-fade-in">
          <div className="card-elevated !p-6 max-w-sm mx-4">
            <h3 className="heading-sm mb-2">{t("messages.closeConfirmTitle")}</h3>
            <p className="text-body-sm mb-6">
              {t("messages.closeConfirmDesc")}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="btn-secondary"
              >
                {t("messages.cancel")}
              </button>
              <button
                onClick={handleCloseConversation}
                className="btn-primary !bg-red-600 hover:!bg-red-700"
              >
                {t("messages.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 backdrop-blur-sm animate-fade-in">
          <div className="card-elevated !p-6 max-w-md mx-4 w-full">
            <h3 className="heading-sm mb-1">{t("review.title", "Rate Your Experience")}</h3>
            <p className="text-body-sm mb-5">
              {t("review.subtitle", "How was your experience with this broker?")}
            </p>

            {/* Star rating */}
            <div className="flex justify-center gap-2 mb-5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  onMouseEnter={() => setReviewHover(star)}
                  onMouseLeave={() => setReviewHover(0)}
                  className="transition-transform hover:scale-110"
                >
                  <svg
                    className={`w-9 h-9 ${
                      star <= (reviewHover || reviewRating)
                        ? "text-amber-400"
                        : "text-cream-300"
                    } transition-colors`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>

            {/* Rating label */}
            {reviewRating > 0 && (
              <p className="text-center text-body-sm font-medium mb-4 animate-fade-in">
                {reviewRating === 1 && t("review.rating1", "Poor")}
                {reviewRating === 2 && t("review.rating2", "Fair")}
                {reviewRating === 3 && t("review.rating3", "Good")}
                {reviewRating === 4 && t("review.rating4", "Very Good")}
                {reviewRating === 5 && t("review.rating5", "Excellent")}
              </p>
            )}

            {/* Comment */}
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder={t("review.commentPlaceholder", "Share your experience (optional)...")}
              className="input-field w-full resize-none mb-5"
              rows={3}
            />

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowReviewModal(false)}
                className="btn-secondary"
              >
                {t("review.skip", "Skip")}
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={reviewRating === 0 || reviewSubmitting}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reviewSubmitting
                  ? t("review.submitting", "Submitting...")
                  : t("review.submit", "Submit Review")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-red-50 border border-red-200 px-5 py-3 shadow-lg animate-fade-in">
          <p className="font-body text-sm text-red-700">
            {error}
            <button
              onClick={() => setError("")}
              className="ml-3 underline text-red-600 font-medium"
            >
              Dismiss
            </button>
          </p>
        </div>
      )}

      <div
        className="flex animate-fade-in"
        style={{ height: "calc(100vh - 80px)" }}
      >
        {/* ──────────────── LEFT PANEL ──────────────── */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-cream-300 bg-cream-100 flex flex-col shrink-0 ${
            mobileShowChat ? "hidden md:flex" : "flex"
          }`}
        >
          {/* List header */}
          <div className="px-5 py-4 border-b border-cream-300">
            <div className="flex items-center justify-between">
              <h1 className="heading-md">{t("messages.title")}</h1>
              <span className="inline-flex items-center justify-center rounded-full bg-forest-100 px-2.5 py-0.5 font-body text-xs font-semibold text-forest-700">
                {conversations.length}
              </span>
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cream-200">
                  <svg
                    className="h-7 w-7 text-forest-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
                    />
                  </svg>
                </div>
                <p className="heading-sm mb-2">{t("messages.noConversations")}</p>
                <p className="text-body-sm">
                  {t("messages.noConversationsDescBorrower")}
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === activeId;
                const lastMsg = conv.messages[0];
                const brokerName =
                  conv.broker.user.name || conv.broker.user.email;
                const hasUnread = (conv.unreadCount ?? 0) > 0;

                return (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv.id)}
                    className={`w-full text-left px-5 py-4 border-b border-cream-200 transition-colors duration-150 hover:bg-cream-200/60 ${
                      isActive
                        ? "bg-cream-200 border-l-[3px] border-l-amber-500"
                        : hasUnread
                          ? "bg-amber-50/40"
                          : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="relative w-10 h-10 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center text-sm font-display font-bold shrink-0">
                        {brokerName.charAt(0).toUpperCase()}
                        {hasUnread && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 font-body text-[10px] font-bold text-white">
                            {conv.unreadCount! > 9 ? "9+" : conv.unreadCount}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className={`font-body text-sm truncate ${hasUnread ? "font-bold text-forest-900" : "font-semibold text-forest-800"}`}>
                            {brokerName}
                          </span>
                          {lastMsg && (
                            <span className={`text-[11px] font-body shrink-0 ${hasUnread ? "text-amber-600 font-semibold" : "text-sage-400"}`}>
                              {relativeTime(lastMsg.createdAt)}
                            </span>
                          )}
                        </div>

                        <p className="text-body-sm truncate mb-1.5">
                          {conv.broker.brokerageName}
                        </p>

                        {/* Badges row */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center rounded-full bg-cream-200 px-2 py-0.5 font-body text-[10px] font-medium text-forest-700">
                            {displayLabel(conv.request.requestType)}
                          </span>
                          {conv.status === "CLOSED" && (
                            <span className="inline-flex items-center rounded-full bg-sage-100 px-2 py-0.5 font-body text-[10px] font-medium text-sage-500">
                              {t("messages.closed")}
                            </span>
                          )}
                        </div>

                        {/* Last message preview */}
                        {lastMsg && (
                          <p className={`text-body-sm truncate ${hasUnread ? "text-forest-700 font-medium" : "text-sage-500"}`}>
                            {lastMsg.senderId === userId ? "You: " : ""}
                            {lastMsg.body}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ──────────────── RIGHT PANEL ──────────────── */}
        <div
          className={`flex-1 flex flex-col bg-cream-50 ${
            !mobileShowChat ? "hidden md:flex" : "flex"
          }`}
        >
          {!activeId ? (
            /* No conversation selected */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cream-200">
                <svg
                  className="h-8 w-8 text-forest-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
                  />
                </svg>
              </div>
              <p className="heading-sm mb-2">{t("messages.selectConversation")}</p>
              <p className="text-body-sm">
                {t("messages.selectConversationDesc")}
              </p>
            </div>
          ) : chatLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-body-sm">Loading conversation...</p>
            </div>
          ) : conversation ? (
            <>
              {/* Chat header */}
              <div className="px-5 py-4 border-b border-cream-300 bg-cream-100 shrink-0">
                <div className="flex items-center gap-3">
                  {/* Mobile back button */}
                  <button
                    onClick={() => setMobileShowChat(false)}
                    className="md:hidden shrink-0 rounded-lg p-1.5 text-forest-600 hover:bg-cream-200 transition-colors"
                    aria-label="Back to conversations"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 19.5 8.25 12l7.5-7.5"
                      />
                    </svg>
                  </button>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center text-sm font-display font-bold shrink-0">
                    {(conversation.broker.user.name || "B")
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-body text-sm font-semibold text-forest-800 truncate">
                        {conversation.broker.user.name || "Broker"}
                      </h2>
                      {conversation.broker.verificationStatus === "VERIFIED" && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-forest-700 bg-forest-100 px-2 py-0.5 rounded-full font-medium font-body shrink-0">
                          <svg
                            className="w-2.5 h-2.5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {t("messages.verified")}
                        </span>
                      )}
                    </div>
                    <p className="text-body-sm truncate">
                      {conversation.broker.brokerageName}
                      <span className="ml-2 font-mono text-[10px] text-sage-400">#{conversation.publicId}</span>
                    </p>
                  </div>

                  {/* Close conversation button */}
                  {!isClosed && (
                    <button
                      onClick={() => setShowCloseConfirm(true)}
                      className="btn-secondary !py-2 !px-3 !text-xs shrink-0"
                    >
                      {t("messages.closeConversation")}
                    </button>
                  )}
                  {isClosed && (
                    <span className="inline-flex items-center rounded-full bg-sage-100 px-3 py-1 font-body text-xs font-medium text-sage-500 shrink-0">
                      {t("messages.closed")}
                    </span>
                  )}
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-body-sm text-sage-400">
                      {t("messages.noMessages")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {groupedMessages.map((group) => (
                      <div key={group.date}>
                        {/* Date divider */}
                        <div className="flex items-center gap-4 mb-4">
                          <div className="flex-1 h-px bg-cream-300" />
                          <span className="text-xs font-body text-sage-400 font-medium">
                            {group.date}
                          </span>
                          <div className="flex-1 h-px bg-cream-300" />
                        </div>

                        <div className="space-y-3">
                          {group.items.map((msg) => {
                            const isMine = msg.senderId === userId;
                            return (
                              <div
                                key={msg.id}
                                className={`flex ${
                                  isMine ? "justify-end" : "justify-start"
                                }`}
                              >
                                <div
                                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                                    isMine
                                      ? "bg-forest-800 text-cream-100"
                                      : "bg-white border border-cream-300 text-forest-800"
                                  }`}
                                >
                                  <p className="text-sm font-body whitespace-pre-wrap break-words">
                                    {msg.body}
                                  </p>
                                  <p
                                    className={`text-[10px] font-body mt-1.5 ${
                                      isMine
                                        ? "text-forest-300"
                                        : "text-sage-400"
                                    }`}
                                  >
                                    {formatTime(
                                      msg.createdAt as unknown as string
                                    )}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Message input */}
              <div className="px-5 py-4 border-t border-cream-300 bg-cream-100 shrink-0">
                {isClosed ? (
                  <div className="rounded-xl bg-sage-50 border border-sage-200 p-3 text-center">
                    <p className="text-body-sm text-sage-500">
                      {t("messages.conversationClosed")}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSend} className="flex gap-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={t("messages.typeMessage")}
                      className="input-field flex-1"
                      disabled={sending}
                    />
                    <button
                      type="submit"
                      disabled={sending || !newMessage.trim()}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sending ? t("messages.sending") : t("messages.send")}
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
