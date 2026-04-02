import { useState, useEffect, useRef, useCallback, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import { getRequestTitle } from "@/lib/requestConfig";

interface ConversationListItem {
  id: string;
  publicId?: string;
  status: string;
  updatedAt: string;
  unreadCount?: number;
  messages: { body: string; createdAt: string; senderId: string }[];
  broker: {
    id: string;
    brokerageName: string;
    verificationStatus: string;
    userId: string;
    user: { id: string; name: string | null; email: string };
  };
  borrower: { id: string; name: string | null; email: string };
  request: { id: string; province: string; mortgageCategory?: string | null };
}

interface FullMessage {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  conversationId: string;
}

interface FullConversation extends ConversationListItem {
  messages: FullMessage[];
}

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

function formatRelativeTime(date: string) {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return formatDate(date);
}

export default function BrokerMessagesPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<FullConversation | null>(null);
  const [messages, setMessages] = useState<FullMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  // Auth guard
  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session || session.user.role !== "BROKER") {
      router.push("/login", undefined, { locale: router.locale });
    }
  }, [session, authStatus, router]);

  // Fetch conversation list
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error(t("errors.failedToLoadConversations"));
      const data: ConversationListItem[] = await res.json();
      setConversations(data);
    } catch {
      setError(t("errors.failedToLoadConversations"));
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchConversations();
    }
  }, [authStatus, fetchConversations]);

  // Fetch active conversation
  const fetchActiveConversation = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}`);
      if (!res.ok) throw new Error(t("errors.failedToLoadConversation"));
      const data: FullConversation = await res.json();
      setActiveConversation(data);
      setMessages(data.messages);
    } catch {
      setError(t("errors.failedToLoadConversation"));
    } finally {
      setLoadingChat(false);
    }
  }, []);

  // Supabase Realtime for instant messages
  useEffect(() => {
    if (!activeConvId || authStatus !== "authenticated") return;

    const channel = supabase
      .channel(`chat-${activeConvId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversationId=eq.${activeConvId}`,
        },
        (payload) => {
          const newMsg = payload.new as FullMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]
          );
          fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${activeConvId}`,
        },
        (payload) => {
          const updated = payload.new as { status: string };
          if (updated.status === "CLOSED") {
            setActiveConversation((prev) =>
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
  }, [activeConvId, authStatus, fetchConversations]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Select a conversation
  function selectConversation(convId: string) {
    setActiveConvId(convId);
    setLoadingChat(true);
    setMessages([]);
    setActiveConversation(null);
    setNewMessage("");
    setMobileView("chat");
    fetchActiveConversation(convId).then(() => {
      // Clear unread count locally for this conversation
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
      );
      // Tell Navbar to refresh its badge
      window.dispatchEvent(new Event("refresh-unread"));
    });
  }

  // Send message
  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = newMessage.trim();
    if (!body || !activeConvId || sending) return;

    setSending(true);
    setNewMessage("");

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConvId, body }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || t("errors.failedToSendMessage"));
      }

      // Message will be added via Supabase Realtime — no need to add here
      await res.json();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errors.failedToSend"));
      setNewMessage(body);
    } finally {
      setSending(false);
    }
  }

  if (authStatus === "loading") {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center" style={{ height: "calc(100vh - 80px)" }}>
          <p className="text-body-sm">{t("common.loading")}</p>
        </div>
      </>
    );
  }

  if (!session || session.user.role !== "BROKER") {
    return null;
  }

  const brokerUserId = activeConversation?.broker?.userId;

  // Group messages by date
  const groupedMessages: { date: string; items: FullMessage[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const dateStr = formatDate(msg.createdAt);
    if (dateStr !== currentDate) {
      currentDate = dateStr;
      groupedMessages.push({ date: dateStr, items: [] });
    }
    groupedMessages[groupedMessages.length - 1].items.push(msg);
  }

  const isClosed = activeConversation?.status === "CLOSED";

  return (
    <>
      <Navbar />
      <div
        className="flex animate-fade-in"
        style={{ height: "calc(100vh - 80px)" }}
      >
        {/* Left panel - Conversation list */}
        <div
          className={`w-80 lg:w-96 shrink-0 border-r border-cream-300 bg-cream-100 flex flex-col ${
            mobileView === "chat" ? "hidden md:flex" : "flex"
          } ${mobileView === "list" ? "w-full md:w-80 lg:md:w-96" : ""}`}
        >
          {/* List header */}
          <div className="shrink-0 border-b border-cream-300 px-5 py-4">
            <div className="flex items-center justify-between">
              <h1 className="heading-md">{t("messages.title")}</h1>
              {!loadingList && (
                <span className="inline-flex items-center rounded-full bg-forest-100 px-2.5 py-1 font-body text-xs font-semibold text-forest-700">
                  {conversations.length}
                </span>
              )}
            </div>
          </div>

          {/* Conversation items */}
          <div className="flex-1 overflow-y-auto">
            {loadingList && (
              <div className="flex items-center justify-center py-16">
                <p className="text-body-sm">Loading conversations...</p>
              </div>
            )}

            {!loadingList && conversations.length === 0 && (
              <div className="px-5 py-16 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-200">
                  <svg
                    className="h-7 w-7 text-sage-500"
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
                <p className="font-body text-sm font-medium text-forest-700">
                  {t("messages.noConversations")}
                </p>
                <p className="text-body-sm mt-1">
                  {t("messages.noConversationsDescBroker")}
                </p>
              </div>
            )}

            {!loadingList &&
              conversations.map((conv) => {
                const lastMessage =
                  conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
                const isActive = conv.id === activeConvId;
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
                      <div className="relative shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-display font-bold text-sm">
                        B
                        {hasUnread && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 font-body text-[10px] font-bold text-white">
                            {conv.unreadCount! > 9 ? "9+" : conv.unreadCount}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-body text-sm truncate ${hasUnread ? "font-bold text-forest-900" : "font-semibold text-forest-800"}`}>
                            {t("messages.borrowerLabel")}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            {conv.status === "CLOSED" && (
                              <span className="inline-flex items-center rounded-full bg-cream-300/50 px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wide text-forest-600 ring-1 ring-inset ring-cream-400/30">
                                {t("status.closed")}
                              </span>
                            )}
                            <span className={`font-body text-[11px] ${hasUnread ? "text-amber-600 font-semibold" : "text-forest-700/40"}`}>
                              {lastMessage
                                ? formatRelativeTime(lastMessage.createdAt)
                                : formatRelativeTime(conv.updatedAt)}
                            </span>
                          </div>
                        </div>

                        <p className="font-body text-xs text-sage-500 mt-0.5">
                          {getRequestTitle(conv.request)} in{" "}
                          {conv.request.province}
                        </p>

                        {lastMessage ? (
                          <p className={`text-body-sm mt-1 truncate ${hasUnread ? "text-forest-700 font-medium" : ""}`}>
                            {lastMessage.body}
                          </p>
                        ) : (
                          <p className="font-body text-xs italic text-sage-400 mt-1">
                            No messages yet
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Right panel - Active chat */}
        <div
          className={`flex-1 flex flex-col bg-cream-50 ${
            mobileView === "list" ? "hidden md:flex" : "flex"
          }`}
        >
          {!activeConvId ? (
            /* No conversation selected */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-6">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-cream-200">
                  <svg
                    className="h-8 w-8 text-sage-400"
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
                <p className="heading-sm text-forest-700">
                  {t("messages.selectConversation")}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="shrink-0 border-b border-cream-300 bg-white px-5 py-3.5">
                <div className="flex items-center gap-3">
                  {/* Mobile back button */}
                  <button
                    onClick={() => {
                      setMobileView("list");
                      setActiveConvId(null);
                      setActiveConversation(null);
                      setMessages([]);
                    }}
                    className="md:hidden shrink-0 rounded-lg p-1.5 text-forest-600 transition-colors hover:bg-cream-200"
                    aria-label={t("chat.backToConversations")}
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
                        d="M15.75 19.5L8.25 12l7.5-7.5"
                      />
                    </svg>
                  </button>

                  {/* Avatar */}
                  <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-display font-bold text-sm">
                    B
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2 className="font-body text-sm font-semibold text-forest-800">
                      {t("messages.borrowerLabel")}
                    </h2>
                    {activeConversation?.request && (
                      <p className="text-body-sm truncate">
                        {getRequestTitle(activeConversation.request)}{" "}
                        in {activeConversation.request.province}
                        {activeConversation.publicId && (
                          <span className="ml-2 font-mono text-[10px] text-sage-400">#{activeConversation.publicId}</span>
                        )}
                      </p>
                    )}
                  </div>

                  {activeConversation?.status && (
                    <span
                      className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
                        activeConversation.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                          : "bg-cream-300/50 text-forest-600 ring-cream-400/30"
                      }`}
                    >
                      {activeConversation.status}
                    </span>
                  )}
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {loadingChat && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-body-sm">Loading messages...</p>
                  </div>
                )}

                {!loadingChat && messages.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-body-sm text-sage-400">
                      {t("messages.noMessages")}
                    </p>
                  </div>
                )}

                {!loadingChat && messages.length > 0 && (
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
                            const isMine = msg.senderId === brokerUserId;
                            return (
                              <div
                                key={msg.id}
                                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
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
                                      isMine ? "text-forest-300" : "text-sage-400"
                                    }`}
                                  >
                                    {formatTime(msg.createdAt)}
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

              {/* Error */}
              {error && (
                <div className="shrink-0 mx-5 mb-3 rounded-xl bg-error-50 border border-error-500/20 p-3 text-sm font-body text-error-700" role="alert">
                  {error}
                  <button
                    onClick={() => setError("")}
                    className="ml-2 underline text-error-600 font-medium"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Message input */}
              <div className="shrink-0 border-t border-cream-300 bg-white px-5 py-3.5">
                {isClosed ? (
                  <div className="text-center py-2">
                    <p className="font-body text-sm text-sage-500">
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
                      {sending ? (
                        <span className="flex items-center gap-2">
                          <svg
                            className="h-4 w-4 animate-spin"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          {t("messages.sending")}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                            />
                          </svg>
                          {t("messages.send")}
                        </span>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});
