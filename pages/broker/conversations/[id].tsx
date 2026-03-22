import { useState, useEffect, useRef, useCallback, FormEvent } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Layout from "@/components/Layout";
import type { Message } from "@/types";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import nextI18NextConfig from "@/next-i18next.config.js";
import type { GetStaticProps, GetStaticPaths } from "next";
import { getRequestTitle } from "@/lib/requestConfig";

interface ConversationData {
  id: string;
  borrower: { id: string; name: string | null; email: string };
  broker: {
    id: string;
    userId: string;
    brokerageName: string;
    user: { id: string; name: string | null; email: string };
  };
  request: {
    id: string;
    requestType?: string | null;
    province: string;
    city: string | null;
    mortgageCategory?: string | null;
    productTypes?: string[] | null;
    schemaVersion?: number | null;
  };
  messages: (Message & {
    sender: { id: string; name: string | null; email: string; role: string };
  })[];
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

function displayLabel(val: string | null | undefined) {
  if (!val) return "";
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function BrokerChatPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status: authStatus } = useSession();
  const { t } = useTranslation("common");

  const [conversation, setConversation] = useState<ConversationData | null>(
    null
  );
  const [messages, setMessages] = useState<ConversationData["messages"]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  const fetchConversation = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) throw new Error("Failed to load conversation");
      const data: ConversationData = await res.json();
      setConversation(data);
      setMessages(data.messages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchMessages = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) return;
      const data: ConversationData = await res.json();
      setMessages(data.messages);
    } catch {
      // Silent fail for polling
    }
  }, [id]);

  // Auth guard
  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session || session.user.role !== "BROKER") {
      router.replace("/login", undefined, { locale: router.locale });
      return;
    }
    if (id) {
      fetchConversation();
    }
  }, [authStatus, session, id, router, fetchConversation]);

  // Polling every 5 seconds
  useEffect(() => {
    if (!id || authStatus !== "authenticated") return;

    pollRef.current = setInterval(fetchMessages, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id, authStatus, fetchMessages]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = newMessage.trim();
    if (!body || !id || sending) return;

    setSending(true);
    setNewMessage("");

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: id, body }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || "Failed to send message");
      }

      const sent = await res.json();
      setMessages((prev) => [
        ...prev,
        { ...sent, sender: { id: session!.user.id, name: session!.user.name, email: session!.user.email, role: "BROKER" } },
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send");
      setNewMessage(body);
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

  if (!session || session.user.role !== "BROKER") {
    return null;
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

  const userId = session.user.id;

  // Group messages by date
  const groupedMessages: { date: string; items: ConversationData["messages"] }[] = [];
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
      <div
        className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col animate-fade-in"
        style={{ height: "calc(100vh - 80px)" }}
      >
        {/* Borrower info header (anonymized) */}
        <div className="card-elevated !p-5 mb-4 shrink-0 animate-fade-in-up stagger-1">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-full bg-sage-100 text-sage-700 flex items-center justify-center text-sm font-display font-bold shrink-0">
              B
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold font-body text-forest-800 truncate">
                {t("messages.borrowerLabel")}
              </h2>
              <p className="text-body-sm truncate">
                {conversation.request ? getRequestTitle(conversation.request) : ""} in{" "}
                {conversation.request?.province}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 p-3 text-sm font-body text-red-700 shrink-0">
            {error}
            <button
              onClick={() => setError("")}
              className="ml-2 underline text-red-600 font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto rounded-2xl border border-cream-300 bg-cream-50 p-4 mb-4 animate-fade-in-up stagger-2">
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
        <form
          onSubmit={handleSend}
          className="shrink-0 flex gap-3 animate-fade-in-up stagger-3"
        >
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

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [],
  fallback: "blocking",
});

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"], nextI18NextConfig)),
  },
});
