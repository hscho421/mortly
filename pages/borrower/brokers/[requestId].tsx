import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Layout from "@/components/Layout";
import type { IntroductionWithBroker } from "@/types";

type SortOption = "fastest" | "highest_rated" | "most_experienced";

function sortIntroductions(
  items: IntroductionWithBroker[],
  sort: SortOption
): IntroductionWithBroker[] {
  const sorted = [...items];
  switch (sort) {
    case "fastest":
      sorted.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      break;
    case "highest_rated":
      sorted.sort((a, b) => (b.broker.rating ?? 0) - (a.broker.rating ?? 0));
      break;
    case "most_experienced":
      sorted.sort(
        (a, b) =>
          (b.broker.yearsExperience ?? 0) - (a.broker.yearsExperience ?? 0)
      );
      break;
  }
  return sorted;
}

export default function BrokerComparison() {
  const router = useRouter();
  const { requestId } = router.query;
  const { data: session, status: authStatus } = useSession();

  const [introductions, setIntroductions] = useState<IntroductionWithBroker[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortOption>("fastest");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const fetchIntroductions = useCallback(async () => {
    if (!requestId) return;
    try {
      const res = await fetch(
        `/api/introductions?requestId=${requestId}`
      );
      if (!res.ok) throw new Error("Failed to fetch introductions");
      const data = await res.json();
      setIntroductions(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace("/api/auth/signin");
      return;
    }
    fetchIntroductions();
  }, [authStatus, router, fetchIntroductions]);

  async function handleSelectBroker(brokerId: string) {
    if (!session?.user || !requestId) return;
    setSelectingId(brokerId);

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, brokerId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to create conversation");
      }

      const data = await res.json();
      router.push(`/borrower/chat/${data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSelectingId(null);
    }
  }

  const sorted = sortIntroductions(introductions, sort);

  if (authStatus === "loading" || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
        <div className="mb-8 animate-fade-in-up stagger-1">
          <h1 className="heading-lg mb-2">
            Broker Introductions
          </h1>
          <p className="text-body">
            Compare brokers who are interested in helping with your mortgage
            request.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm font-body text-amber-800 animate-fade-in-up stagger-2">
          Information shown is self-reported by brokers. We recommend verifying
          credentials independently.
        </div>

        {error && (
          <div className="mb-6 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm font-body text-red-700">
            {error}
          </div>
        )}

        {/* Sort controls */}
        <div className="flex items-center gap-3 mb-6 animate-fade-in-up stagger-3">
          <span className="text-body-sm">Sort by:</span>
          {(
            [
              ["fastest", "Fastest Response"],
              ["highest_rated", "Highest Rated"],
              ["most_experienced", "Most Experienced"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setSort(value)}
              className={`px-4 py-2 text-sm font-body font-medium rounded-xl transition-all duration-200 ${
                sort === value
                  ? "bg-forest-800 text-cream-100 shadow-md shadow-forest-800/20"
                  : "bg-cream-200 text-forest-700 hover:bg-cream-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Introduction cards */}
        {sorted.length === 0 ? (
          <div className="text-center py-16 animate-fade-in-up stagger-4">
            <p className="heading-sm text-sage-400 mb-2">No broker introductions yet</p>
            <p className="text-body-sm text-sage-400">
              Check back soon -- brokers are reviewing your request.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {sorted.map((intro, index) => {
              const broker = intro.broker;
              const isExpanded = expandedId === intro.id;
              const isSelecting = selectingId === broker.id;

              return (
                <div
                  key={intro.id}
                  className={`card-elevated hover:shadow-xl hover:shadow-forest-800/5 transition-all duration-300 animate-fade-in-up ${
                    index < 6 ? `stagger-${index + 1}` : ""
                  }`}
                >
                  {/* Broker header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center text-lg font-display font-bold shrink-0">
                        {(broker.user.name || "B").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold font-body text-forest-800">
                            {broker.user.name || "Broker"}
                          </h3>
                          {broker.verificationStatus === "VERIFIED" && (
                            <span className="inline-flex items-center gap-1 text-xs text-forest-700 bg-forest-100 px-2 py-0.5 rounded-full font-medium font-body">
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
                              Verified
                            </span>
                          )}
                        </div>
                        <p className="text-body-sm">
                          {broker.brokerageName}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs font-body text-sage-400">
                          {broker.yearsExperience != null && (
                            <span>
                              {broker.yearsExperience} years experience
                            </span>
                          )}
                          {broker.rating != null && (
                            <span className="flex items-center gap-1">
                              <span className="text-amber-500">&#9733;</span>
                              {broker.rating.toFixed(1)} rating
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Message preview / full */}
                  <div className="mt-5">
                    <p className="text-xs font-semibold font-body text-sage-500 uppercase tracking-widest mb-1">
                      How they can help
                    </p>
                    <p className="text-body">
                      {isExpanded
                        ? intro.howCanHelp
                        : intro.howCanHelp.length > 200
                          ? intro.howCanHelp.slice(0, 200) + "..."
                          : intro.howCanHelp}
                    </p>

                    {isExpanded && (
                      <div className="mt-5 space-y-4 border-t divider pt-5">
                        {intro.personalMessage && (
                          <div>
                            <p className="text-xs font-semibold font-body text-sage-500 uppercase tracking-widest mb-1">
                              Personal message
                            </p>
                            <p className="text-body">
                              {intro.personalMessage}
                            </p>
                          </div>
                        )}
                        {intro.experience && (
                          <div>
                            <p className="text-xs font-semibold font-body text-sage-500 uppercase tracking-widest mb-1">
                              Relevant experience
                            </p>
                            <p className="text-body">
                              {intro.experience}
                            </p>
                          </div>
                        )}
                        {intro.lenderNetwork && (
                          <div>
                            <p className="text-xs font-semibold font-body text-sage-500 uppercase tracking-widest mb-1">
                              Lender network
                            </p>
                            <p className="text-body">
                              {intro.lenderNetwork}
                            </p>
                          </div>
                        )}
                        {intro.estimatedTimeline && (
                          <div>
                            <p className="text-xs font-semibold font-body text-sage-500 uppercase tracking-widest mb-1">
                              Estimated timeline
                            </p>
                            <p className="text-body">
                              {intro.estimatedTimeline}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-6 flex items-center gap-3 pt-5 border-t divider">
                    <button
                      onClick={() => handleSelectBroker(broker.id)}
                      disabled={isSelecting}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSelecting ? "Connecting..." : "Select This Broker"}
                    </button>
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : intro.id)
                      }
                      className="btn-secondary"
                    >
                      {isExpanded
                        ? "Show Less"
                        : "View Full Introduction"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
