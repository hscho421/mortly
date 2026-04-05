import { useState, useEffect, useRef, useCallback, FormEvent } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Head from "next/head";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import nextI18NextConfig from "@/next-i18next.config.js";
import type { GetServerSideProps } from "next";
import Layout from "@/components/Layout";
import ChatDisclaimer, { useDisclaimerNeeded } from "@/components/ChatDisclaimer";
import type { ConversationWithParticipants } from "@/types";
import type { Message } from "@/types";
import { getRequestTitle } from "@/lib/requestConfig";

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

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"], nextI18NextConfig)),
  },
});

export default function ChatPage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const { conversationId } = router.query;
  const { data: session, status: authStatus } = useSession();

  const [conversation, setConversation] =
    useState<ConversationWithParticipants | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const convId = typeof conversationId === "string" ? conversationId : null;
  const { disclaimerNeeded, acceptDisclaimer } = useDisclaimerNeeded(convId);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  const fetchConversation = useCallback(async () => {
    if (!conversationId) return;
    try {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (!res.ok) throw new Error(t("borrowerChat.failedToLoad"));
      const data: ConversationWithParticipants = await res.json();
      setConversation(data);
      setMessages(data.messages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("borrowerChat.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (!res.ok) return;
      const data: ConversationWithParticipants = await res.json();
      setMessages(data.messages);
    } catch {
      // Silent fail for polling
    }
  }, [conversationId]);

  // Initial load
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace("/login", undefined, { locale: router.locale });
      return;
    }
    if (authStatus === "authenticated" && conversationId) {
      fetchConversation();
    }
  }, [authStatus, conversationId, router, fetchConversation]);

  // Polling every 5 seconds
  useEffect(() => {
    if (!conversationId || authStatus !== "authenticated") return;

    pollRef.current = setInterval(fetchMessages, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [conversationId, authStatus, fetchMessages]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = newMessage.trim();
    if (!body || !conversationId || sending) return;

    setSending(true);
    setNewMessage("");

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, body }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || t("errors.failedToSendMessage"));
      }

      const sent: Message = await res.json();
      setMessages((prev) => [...prev, sent]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errors.failedToSend"));
      setNewMessage(body); // Restore the message on failure
    } finally {
      setSending(false);
    }
  }

  if (authStatus === "loading" || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">{t("messages.loading")}</p>
        </div>
      </Layout>
    );
  }

  if (!conversation) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">{t("messages.notFound")}</p>
        </div>
      </Layout>
    );
  }

  const broker = conversation.broker;
  const userId = session?.user?.id;

  // Group messages by date
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

  return (
    <Layout>
      <Head><title>{t("borrowerDashboard.chat")}</title></Head>
      {/* Chat disclaimer */}
      {disclaimerNeeded && convId && (
        <ChatDisclaimer conversationId={convId} onAccept={acceptDisclaimer} />
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col animate-fade-in" style={{ height: "calc(100vh - 80px)" }}>
        {/* Broker info header */}
        <div className="card-elevated !p-5 mb-4 shrink-0 animate-fade-in-up stagger-1">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center text-sm font-display font-bold shrink-0">
              {(broker.user.name || "B").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold font-body text-forest-800 truncate">
                {broker.user.name || t("misc.broker")}
              </h2>
              <p className="text-body-sm truncate">
                {broker.brokerageName}
                {conversation.request && (
                  <span>
                    {" "}
                    &middot;{" "}
                    {getRequestTitle(conversation.request)}{" "}
                    {t("misc.in")} {conversation.request.province}
                  </span>
                )}
              </p>
            </div>
            {broker.verificationStatus === "VERIFIED" && (
              <span className="inline-flex items-center gap-1 text-xs text-forest-700 bg-forest-100 px-2.5 py-1 rounded-full font-medium font-body shrink-0">
                <svg
                  className="w-3 h-3"
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
        </div>

        {/* Identity note */}
        <div className="rounded-2xl bg-forest-50 border border-forest-200 p-3.5 mb-4 shrink-0 animate-fade-in-up stagger-2">
          <p className="text-xs font-body text-forest-700">
            {t("messages.privacyReminder")}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl bg-error-50 border border-error-500/20 p-3 text-sm font-body text-error-700 shrink-0" role="alert">
            {error}
            <button
              onClick={() => setError("")}
              className="ml-2 underline text-error-600 font-medium"
            >
              {t("messages.dismiss")}
            </button>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto rounded-2xl border border-cream-300 bg-cream-50 p-4 mb-4 animate-fade-in-up stagger-3">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-body-sm text-sage-400">{t("messages.noMessages")}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedMessages.map((group) => (
                <div key={group.date}>
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
                              {formatTime(msg.createdAt as unknown as string)}
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
        <form onSubmit={handleSend} className="shrink-0 flex gap-3 animate-fade-in-up stagger-4">
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
      </div>
    </Layout>
  );
}
