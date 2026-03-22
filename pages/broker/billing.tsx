import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  name: string;
  tier: string;
  price: string;
  period: string;
  credits: string;
  features: PlanFeature[];
  highlighted: boolean;
}

const TIER_RANK: Record<string, number> = { FREE: 0, BASIC: 1, PRO: 2, PREMIUM: 3 };

const CREDIT_PACKS = [
  { type: "SMALL", credits: 3, price: "$29", label: "smallPack" },
  { type: "LARGE", credits: 10, price: "$79", label: "largePack", best: true },
] as const;

function usePlans(t: (key: string) => string): Plan[] {
  return [
    {
      name: t("billing.freeName"),
      tier: "FREE",
      price: "$0",
      period: "",
      credits: t("billing.freeCredits"),
      features: [
        { text: t("billing.feat_verified"), included: true },
        { text: t("billing.feat_browseRequests"), included: true },
        { text: t("billing.feat_basicListing"), included: true },
        { text: t("billing.feat_sendIntros"), included: false },
        { text: t("billing.feat_priority"), included: false },
        { text: t("billing.feat_analytics"), included: false },
      ],
      highlighted: false,
    },
    {
      name: t("billing.basicName"),
      tier: "BASIC",
      price: "$49",
      period: t("billing.perMonth"),
      credits: t("billing.basicCredits"),
      features: [
        { text: t("billing.feat_browseRequests"), included: true },
        { text: t("billing.feat_5intros"), included: true },
        { text: t("billing.feat_basicListing"), included: true },
        { text: t("billing.feat_priority"), included: false },
        { text: t("billing.feat_analytics"), included: false },
        { text: t("billing.feat_badge"), included: false },
      ],
      highlighted: false,
    },
    {
      name: t("billing.proName"),
      tier: "PRO",
      price: "$149",
      period: t("billing.perMonth"),
      credits: t("billing.proCredits"),
      features: [
        { text: t("billing.feat_browseRequests"), included: true },
        { text: t("billing.feat_20intros"), included: true },
        { text: t("billing.feat_enhancedListing"), included: true },
        { text: t("billing.feat_priority"), included: true },
        { text: t("billing.feat_analytics"), included: true },
        { text: t("billing.feat_badge"), included: false },
      ],
      highlighted: true,
    },
    {
      name: t("billing.premiumName"),
      tier: "PREMIUM",
      price: "$349",
      period: t("billing.perMonth"),
      credits: t("billing.premiumCredits"),
      features: [
        { text: t("billing.feat_browseRequests"), included: true },
        { text: t("billing.feat_unlimitedIntros"), included: true },
        { text: t("billing.feat_premiumListing"), included: true },
        { text: t("billing.feat_topPriority"), included: true },
        { text: t("billing.feat_advancedAnalytics"), included: true },
        { text: t("billing.feat_badge"), included: true },
      ],
      highlighted: false,
    },
  ];
}

export default function BrokerBillingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");

  const plans = usePlans(t);
  const [currentTier, setCurrentTier] = useState("");
  const [responseCredits, setResponseCredits] = useState<number | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchaseMessage, setPurchaseMessage] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "BROKER") return;

    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/brokers/profile");
        if (res.ok) {
          const data = await res.json();
          setCurrentTier(data.subscriptionTier || "FREE");
          setResponseCredits(data.responseCredits ?? 0);
        }
      } catch {
        // Fall back to defaults
        setCurrentTier("FREE");
        setResponseCredits(0);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [session, status]);

  const canBuyCredits =
    (currentTier === "BASIC" || currentTier === "PRO") &&
    responseCredits === 0;

  const handlePurchase = async (packType: string) => {
    setPurchasing(packType);
    setPurchaseMessage("");

    try {
      const res = await fetch("/api/credits/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packType }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPurchaseMessage(data.error || t("credits.purchaseError"));
        return;
      }

      setResponseCredits(data.credits);
      setPurchaseMessage(t("credits.purchaseSuccess"));
      setTimeout(() => {
        setShowPurchaseModal(false);
        setPurchaseMessage("");
      }, 1500);
    } catch {
      setPurchaseMessage(t("credits.purchaseError"));
    } finally {
      setPurchasing(null);
    }
  };

  if (status === "loading" || isLoadingProfile) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-body-sm">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!session || session.user.role !== "BROKER") {
    if (typeof window !== "undefined") {
      router.push("/login", undefined, { locale: router.locale });
    }
    return null;
  }

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10 animate-fade-in">
          <h1 className="heading-lg">{t("broker.billingTitle")}</h1>
          <p className="text-body mt-2">{t("broker.billingSubtitle")}</p>
        </div>

        {/* Current plan summary */}
        <div className="card-elevated mb-10 animate-fade-in-up stagger-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="heading-sm">{t("broker.currentPlan")}</h2>
              <p className="text-body mt-1">
                {t("broker.currentPlanDesc", { tier: currentTier })}
              </p>
            </div>
            <div className="text-right">
              <p className="font-body text-xs font-medium uppercase tracking-wider text-forest-700/50">{t("broker.responseCredits")}</p>
              <p className={`font-display text-3xl tracking-tight ${responseCredits === 0 ? "text-red-600" : "text-amber-700"}`}>
                {currentTier === "PREMIUM" ? t("broker.unlimited", "Unlimited") : responseCredits}
              </p>
            </div>
          </div>
        </div>

        {/* Zero credits banner */}
        {canBuyCredits && (
          <div className="mb-10 animate-fade-in-up stagger-2 rounded-2xl border-2 border-amber-300 bg-amber-50 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-200">
                  <svg className="h-5 w-5 text-amber-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-body text-sm font-semibold text-forest-800">{t("credits.noCreditsTitle")}</h3>
                  <p className="mt-1 font-body text-sm text-forest-700/70">{t("credits.noCreditsDesc")}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPurchaseModal(true)}
                className="btn-amber shrink-0"
              >
                {t("credits.buyCredits")}
              </button>
            </div>
          </div>
        )}

        {/* Plan comparison */}
        <h2 className="heading-md mb-6 animate-fade-in stagger-2">{t("broker.choosePlan")}</h2>
        <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, i) => (
            <div
              key={plan.tier}
              className={`relative card-elevated animate-fade-in-up stagger-${Math.min(i + 3, 6)} ${
                plan.highlighted
                  ? "border-amber-400 ring-2 ring-amber-400"
                  : ""
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-4 py-1 font-body text-xs font-semibold text-forest-900">
                  {t("broker.mostPopular")}
                </span>
              )}
              <h3 className="heading-sm">{plan.name}</h3>
              <div className="mt-3">
                <span className="font-display text-4xl tracking-tight text-forest-800">{plan.price}</span>
                <span className="text-body-sm">{plan.period}</span>
              </div>
              <p className="text-body-sm mt-1">{plan.credits}</p>

              <hr className="divider my-6" />

              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature.text} className="flex items-start gap-2.5">
                    {feature.included ? (
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-forest-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-cream-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    <span className={`font-body text-sm ${feature.included ? "text-forest-700" : "text-sage-400"}`}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                className={`mt-8 w-full ${
                  currentTier === plan.tier
                    ? "btn-secondary cursor-default opacity-60"
                    : plan.highlighted
                      ? "btn-amber"
                      : "btn-secondary"
                }`}
                disabled={currentTier === plan.tier}
              >
                {currentTier === plan.tier
                  ? t("broker.currentPlanBtn")
                  : (TIER_RANK[plan.tier] ?? 0) > (TIER_RANK[currentTier] ?? 0)
                    ? t("broker.upgrade")
                    : t("broker.downgrade", "Downgrade")}
              </button>
            </div>
          ))}
        </div>

        {/* Billing history */}
        <h2 className="heading-md mb-5 animate-fade-in">{t("broker.billingHistory")}</h2>
        <div className="card-elevated py-16 text-center animate-fade-in-up">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cream-200">
            <svg className="h-6 w-6 text-sage-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          <p className="font-body text-sm font-medium text-forest-700">{t("broker.noBillingHistory")}</p>
          <p className="text-body-sm mt-1">
            {t("broker.noBillingHistoryDesc")}
          </p>
        </div>
      </div>

      {/* Credit Purchase Modal */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-forest-900/50 backdrop-blur-sm"
            onClick={() => { if (!purchasing) setShowPurchaseModal(false); }}
          />
          <div className="relative w-full max-w-md animate-fade-in-up rounded-2xl bg-white p-8 shadow-2xl">
            <button
              onClick={() => { if (!purchasing) setShowPurchaseModal(false); }}
              className="absolute right-4 top-4 rounded-lg p-1 text-sage-400 transition-colors hover:text-forest-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="heading-md mb-2">{t("credits.purchaseCredits")}</h3>
            <p className="text-body-sm mb-6">{t("credits.noCreditsDesc")}</p>

            <div className="space-y-4">
              {CREDIT_PACKS.map((pack) => (
                <div
                  key={pack.type}
                  className={`relative rounded-xl border-2 p-5 transition-all ${
                    "best" in pack && pack.best
                      ? "border-amber-400 bg-amber-50"
                      : "border-cream-300 bg-cream-50"
                  }`}
                >
                  {"best" in pack && pack.best && (
                    <span className="absolute -top-2.5 right-4 rounded-full bg-amber-500 px-3 py-0.5 font-body text-xs font-semibold text-forest-900">
                      {t("credits.bestValue")}
                    </span>
                  )}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-body text-sm font-semibold text-forest-800">
                        {t(`credits.${pack.label}`)}
                      </h4>
                      <p className="mt-0.5 font-body text-sm text-forest-700/60">
                        {pack.credits} {t("credits.credits")}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-display text-2xl tracking-tight text-forest-800">
                        {pack.price}
                      </span>
                      <button
                        onClick={() => handlePurchase(pack.type)}
                        disabled={!!purchasing}
                        className="btn-amber px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {purchasing === pack.type
                          ? t("credits.purchasing")
                          : t("credits.buyCredits")}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {purchaseMessage && (
              <div className={`mt-4 rounded-lg p-3 text-center font-body text-sm ${
                purchaseMessage === t("credits.purchaseSuccess")
                  ? "bg-forest-50 text-forest-700"
                  : "bg-red-50 text-red-700"
              }`}>
                {purchaseMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});
