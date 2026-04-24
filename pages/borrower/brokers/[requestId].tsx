import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Head from "next/head";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import nextI18NextConfig from "@/next-i18next.config.js";
import type { GetServerSideProps } from "next";
import Layout from "@/components/Layout";
import { SkeletonBrokerList } from "@/components/Skeleton";
import ReportButton from "@/components/ReportButton";

interface ConversationBroker {
  id: string;
  createdAt: string;
  status: string;
  _count?: { messages: number };
  broker: {
    id: string;
    brokerageName: string;
    verificationStatus: string;
    yearsExperience: number | null;
    specialties: string | null;
    bio: string | null;
    user: {
      id: string;
      publicId: string;
      name: string | null;
      email: string;
    };
  };
}

type SortOption = "fastest" | "most_experienced";

function sortConversations(
  items: ConversationBroker[],
  sort: SortOption
): ConversationBroker[] {
  const sorted = [...items];
  switch (sort) {
    case "fastest":
      sorted.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
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

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"], nextI18NextConfig)),
  },
});

export default function BrokerComparison() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const { requestId } = router.query;
  const { data: session, status: authStatus } = useSession();

  const [conversations, setConversations] = useState<ConversationBroker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortOption>("fastest");

  const fetchConversations = useCallback(async () => {
    if (!requestId) return;
    try {
      const res = await fetch(`/api/requests/${requestId}`);
      if (!res.ok) throw new Error(t("common.failedToLoad"));
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }, [requestId, t]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace("/login", undefined, { locale: router.locale });
      return;
    }
    fetchConversations();
  }, [authStatus, router, fetchConversations]);

  const sorted = sortConversations(conversations, sort);

  if (authStatus === "loading" || loading) {
    return (
      <Layout>
        <SkeletonBrokerList />
      </Layout>
    );
  }

  return (
    <Layout>
      <Head><title>{t("titles.borrowerBrokers")}</title></Head>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 ">
        <div className="mb-8">
          <h1 className="heading-lg mb-2">
            {t("brokerIntros.title")}
          </h1>
          <p className="text-body">
            {t("brokerIntros.subtitle")}
          </p>
        </div>

        {/* Disclaimer */}
        <div className="mb-6 rounded-sm bg-amber-50 border border-amber-200 p-4 text-sm font-body text-amber-800">
          {t("brokerIntros.disclaimer")}
        </div>

        {error && (
          <div className="mb-6 rounded-sm bg-error-50 border border-error-500/20 p-4 text-sm font-body text-error-700" role="alert">
            {error}
          </div>
        )}

        {/* Sort controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6">
          <span className="text-body-sm">{t("brokerIntros.sortBy")}</span>
          {(
            [
              ["fastest", t("brokerIntros.fastestResponse")],
              ["most_experienced", t("brokerIntros.mostExperienced")],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setSort(value)}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-body font-medium rounded-sm transition-all duration-200 min-h-[44px] ${
                sort === value
                  ? "bg-forest-800 text-cream-100 shadow-md shadow-forest-800/20"
                  : "bg-cream-200 text-forest-700 hover:bg-cream-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Broker cards */}
        {sorted.length === 0 ? (
          <div className="text-center py-16">
            <p className="heading-sm text-sage-400 mb-2">{t("brokerIntros.noIntros")}</p>
            <p className="text-body-sm text-sage-400">
              {t("brokerIntros.noIntrosDesc")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {sorted.map((conv, index) => {
              const broker = conv.broker;

              return (
                <div
                  key={conv.id}
                  className={`card-elevated hover:shadow-xl hover:shadow-forest-800/5 transition-all duration-300 ${
                    ""
                  }`}
                >
                  {/* Broker header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center text-base sm:text-lg font-display font-bold shrink-0">
                        {(broker.user.name || "B").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold font-body text-forest-800">
                            {broker.user.name || t("misc.broker")}
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
                              {t("messages.verified")}
                            </span>
                          )}
                        </div>
                        <p className="text-body-sm">
                          {broker.brokerageName}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs font-body text-sage-400">
                          {broker.yearsExperience != null && (
                            <span>
                              {t("brokerCard.yearsExperience_other", { count: broker.yearsExperience })}
                            </span>
                          )}
                          {conv._count?.messages != null && (
                            <span>
                              {t("brokerComparison.messagesExchanged", { count: conv._count.messages })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ReportButton targetType="BROKER" targetId={broker.user.publicId} />
                  </div>

                  {/* Specialties */}
                  {broker.specialties && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-body font-medium text-sage-500">{t("brokerComparison.specialties")}:</span>
                      {broker.specialties.split(",").map((s, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-body font-medium text-forest-700"
                        >
                          {s.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-6 flex items-center gap-3 pt-5 border-t divider">
                    <button
                      onClick={() =>
                        router.push(`/borrower/messages?id=${conv.id}`, undefined, { locale: router.locale })
                      }
                      className="btn-primary"
                    >
                      {t("request.viewMessages")}
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
