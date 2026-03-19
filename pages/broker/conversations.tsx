import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "@/components/Layout";
import type { ConversationWithParticipants } from "@/types";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function BrokerConversationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [conversations, setConversations] = useState<ConversationWithParticipants[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "BROKER") {
      router.push("/login");
      return;
    }

    const fetchConversations = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/conversations");
        if (!res.ok) throw new Error("Failed to fetch conversations");
        const data = await res.json();
        setConversations(data);
      } catch {
        setError("Failed to load conversations.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversations();
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-body-sm">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!session || session.user.role !== "BROKER") {
    return null;
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="heading-lg">Conversations</h1>
          <p className="text-body mt-2">
            Messages with borrowers who accepted your introductions.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 animate-fade-in">
            <p className="font-body text-sm text-red-700">{error}</p>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-16">
            <p className="text-body-sm">Loading conversations...</p>
          </div>
        )}

        {!isLoading && conversations.length === 0 && (
          <div className="card-elevated py-16 text-center animate-fade-in">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-200">
              <svg className="h-7 w-7 text-sage-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
            </div>
            <p className="font-body text-sm font-medium text-forest-700">No conversations yet.</p>
            <p className="text-body-sm mt-1">
              Conversations will appear here when borrowers accept your introductions.
            </p>
            <Link
              href="/broker/requests"
              className="btn-primary mt-6 inline-flex"
            >
              Browse Requests
            </Link>
          </div>
        )}

        {!isLoading && conversations.length > 0 && (
          <div className="space-y-3">
            {conversations.map((conv: ConversationWithParticipants, i: number) => {
              const lastMessage =
                conv.messages.length > 0
                  ? conv.messages[conv.messages.length - 1]
                  : null;

              return (
                <Link
                  key={conv.id}
                  href={`/broker/conversations/${conv.id}`}
                  className={`card block animate-fade-in-up stagger-${Math.min(i + 1, 6)} hover:border-forest-300`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-body text-sm font-semibold text-forest-800">
                          {conv.request.requestType} in{" "}
                          {conv.request.city ? `${conv.request.city}, ` : ""}
                          {conv.request.province}
                        </h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 font-body text-xs font-medium ${
                            conv.status === "ACTIVE"
                              ? "bg-forest-100 text-forest-700"
                              : "bg-sage-100 text-sage-600"
                          }`}
                        >
                          {conv.status}
                        </span>
                      </div>
                      {lastMessage ? (
                        <p className="mt-1.5 truncate text-body-sm">
                          {lastMessage.body}
                        </p>
                      ) : (
                        <p className="mt-1.5 font-body text-sm italic text-sage-400">No messages yet</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-body text-xs text-forest-700/40">
                        {formatDate(conv.updatedAt as unknown as string)}
                      </p>
                      <svg className="mt-2 ml-auto h-4 w-4 text-forest-700/30" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
