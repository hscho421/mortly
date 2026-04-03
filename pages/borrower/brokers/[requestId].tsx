import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import nextI18NextConfig from "@/next-i18next.config.js";
import type { GetServerSideProps } from "next";
import Layout from "@/components/Layout";
import ReportButton from "@/components/ReportButton";
import type { IntroductionWithBroker } from "@/types";
import posthog from "posthog-js";

type SortOption = "fastest" | "most_experienced";

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
      if (!res.ok) throw new Error(t("errors.failedToFetchIntroductions"));
      const data = await res.json();
      setIntroductions(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace("/login", undefined, { locale: router.locale });
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
        throw new Error(data.message || t("errors.failedToCreateConversation"));
      }

      const data = await res.json();
      posthog.capture("broker_selected", {
        broker_id: brokerId,
        request_id: requestId,
      });
      router.push(`/borrower/messages?id=${data.id}`, undefined, { locale: router.locale });
    } catch (err: unknown) {
      posthog.captureException(err);
      setError(err instanceof Error ? err.message : t("common.somethingWentWrong"));
      setSelectingId(null);
    }
  }

  const sorted = sortIntroductions(introductions, sort);

  if (authStatus === "loading" || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">{t("common.loading")}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
        <div className="mb-8 animate-fade-in-up stagger-1">
          <h1 className="heading-lg mb-2">
            {t("brokerIntros.title")}
          </h1>
          <p className="text-body">
            {t("brokerIntros.subtitle")}
          </p>
        </div>

        {/* Disclaimer */}
        <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm font-body text-amber-800 animate-fade-in-up stagger-2">
          {t("brokerIntros.disclaimer")}
        </div>

        {error && (
          <div className="mb-6 rounded-2xl bg-error-50 border border-error-500/20 p-4 text-sm font-body text-error-700" role="alert">
            {error}
          </div>
        )}

        {/* Sort controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6 animate-fade-in-up stagger-3">
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
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-body font-medium rounded-xl transition-all duration-200 min-h-[44px] ${
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
            <p className="heading-sm text-sage-400 mb-2">{t("brokerIntros.noIntros")}</p>
            <p className="text-body-sm text-sage-400">
              {t("brokerIntros.noIntrosDesc")}
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
                        </div>
                      </div>
                    </div>
                    <ReportButton targetType="BROKER" targetId={broker.user.publicId} />
                  </div>

                  {/* Message preview / full */}
                  <div className="mt-5">
                    <p className="text-xs font-semibold font-body text-sage-500 uppercase tracking-widest mb-1">
                      {t("brokerIntros.message")}
                    </p>
                    {(() => {
                      const text = intro.message || intro.howCanHelp || "";
                      return (
                        <p className="text-body whitespace-pre-line">
                          {isExpanded
                            ? text
                            : text.length > 200
                              ? text.slice(0, 200) + "..."
                              : text}
                        </p>
                      );
                    })()}
                  </div>

                  {/* Actions */}
                  <div className="mt-6 flex items-center gap-3 pt-5 border-t divider">
                    <button
                      onClick={() => handleSelectBroker(broker.id)}
                      disabled={isSelecting}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSelecting ? t("brokerIntros.connecting") : t("brokerIntros.selectBroker")}
                    </button>
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : intro.id)
                      }
                      className="btn-secondary"
                    >
                      {isExpanded
                        ? t("brokerIntros.showLess")
                        : t("brokerIntros.viewFull")}
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
