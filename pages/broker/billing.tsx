import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import Layout from "@/components/Layout";
import { SkeletonBilling } from "@/components/Skeleton";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import posthog from "posthog-js";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  name: string;
  tier: string;
  price: string;
  originalPrice: string | null;
  discount: string | null;
  period: string;
  credits: string;
  description: string;
  features: PlanFeature[];
  highlighted: boolean;
}

interface SubscriptionData {
  stripeSubscriptionId: string | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  pendingTier: string | null;
}

interface Invoice {
  id: string;
  number: string | null;
  amountPaid: number;
  currency: string;
  status: string | null;
  created: number;
  invoicePdf: string | null;
  hostedInvoiceUrl: string | null;
}

const TIER_RANK: Record<string, number> = { FREE: 0, BASIC: 1, PRO: 2, PREMIUM: 3 };

function usePlans(t: (key: string) => string): Plan[] {
  return [
    {
      name: t("pricing.freeName"),
      tier: "FREE",
      price: "$0",
      originalPrice: null,
      discount: null,
      period: "",
      credits: t("pricing.val_none"),
      description: t("pricing.freeDesc"),
      features: [
        { text: t("pricing.feat_responses") + ": " + t("pricing.val_none"), included: false },
        { text: t("pricing.feat_notifications"), included: false },
        { text: t("pricing.feat_realtimeAlerts"), included: false },
      ],
      highlighted: false,
    },
    {
      name: t("pricing.basicName"),
      tier: "BASIC",
      price: "$29",
      originalPrice: "$49",
      discount: "41%",
      period: t("pricing.perMonth"),
      credits: t("pricing.val_5perMonth"),
      description: t("pricing.basicDesc"),
      features: [
        { text: t("pricing.feat_responses") + ": " + t("pricing.val_5perMonth"), included: true },
        { text: t("pricing.feat_notifications"), included: false },
        { text: t("pricing.feat_realtimeAlerts"), included: false },
      ],
      highlighted: false,
    },
    {
      name: t("pricing.proName"),
      tier: "PRO",
      price: "$69",
      originalPrice: "$99",
      discount: "30%",
      period: t("pricing.perMonth"),
      credits: t("pricing.val_20perMonth"),
      description: t("pricing.proDesc"),
      features: [
        { text: t("pricing.feat_responses") + ": " + t("pricing.val_20perMonth"), included: true },
        { text: t("pricing.feat_notifications"), included: true },
        { text: t("pricing.feat_realtimeAlerts"), included: false },
      ],
      highlighted: true,
    },
    {
      name: t("pricing.premiumName"),
      tier: "PREMIUM",
      price: "$129",
      originalPrice: "$199",
      discount: "35%",
      period: t("pricing.perMonth"),
      credits: t("pricing.val_unlimited"),
      description: t("pricing.premiumDesc"),
      features: [
        { text: t("pricing.feat_responses") + ": " + t("pricing.val_unlimited"), included: true },
        { text: t("pricing.feat_notifications"), included: true },
        { text: t("pricing.feat_realtimeAlerts"), included: true },
      ],
      highlighted: false,
    },
  ];
}

function formatInvoiceDate(timestamp: number, locale: string): string {
  return new Date(timestamp * 1000).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export default function BrokerBillingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");

  const plans = usePlans(t);
  const [currentTier, setCurrentTier] = useState("");
  const [responseCredits, setResponseCredits] = useState<number | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [downgradeTarget, setDowngradeTarget] = useState<string | null>(null);

  // Show success banner from checkout redirect
  useEffect(() => {
    if (router.query.checkout === "success") {
      setSuccessMessage(t("broker.subscriptionActivated"));
      router.replace("/broker/billing", undefined, { shallow: true, locale: router.locale });
    }
  }, [router.query.checkout, router, t]);

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
          if (data.subscription) {
            setSubscription({
              stripeSubscriptionId: data.subscription.stripeSubscriptionId,
              status: data.subscription.status,
              cancelAtPeriodEnd: data.subscription.cancelAtPeriodEnd,
              currentPeriodEnd: data.subscription.currentPeriodEnd,
              pendingTier: data.subscription.pendingTier,
            });
          }
        }
      } catch {
        setCurrentTier("FREE");
        setResponseCredits(0);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    const fetchInvoices = async () => {
      try {
        const res = await fetch("/api/stripe/invoices");
        if (res.ok) {
          setInvoices(await res.json());
        }
      } catch {
        // Invoices are non-critical
      }
    };

    fetchProfile();
    fetchInvoices();
  }, [session, status]);

  const hasStripeSubscription = !!subscription?.stripeSubscriptionId;

  const handleSelectPlan = async (tier: string) => {
    if (tier === currentTier || actionLoading) return;

    const isDowngrade = (TIER_RANK[tier] ?? 0) < (TIER_RANK[currentTier] ?? 0);
    posthog.capture("billing_plan_selected", {
      selected_tier: tier,
      current_tier: currentTier,
      is_upgrade: !isDowngrade,
    });

    // Downgrade to FREE → open portal to cancel
    if (tier === "FREE" && hasStripeSubscription) {
      handleManageSubscription();
      return;
    }

    // Confirm downgrade via modal
    if (isDowngrade) {
      setDowngradeTarget(tier);
      return;
    }

    await executePlanChange(tier);
  };

  const executePlanChange = async (tier: string) => {
    setDowngradeTarget(null);
    setActionLoading(tier);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();

      if (!res.ok) {
        console.error("Checkout error:", data.error);
        return;
      }

      if (data.updated) {
        if (data.scheduled) {
          // Downgrade scheduled for next cycle — no DB change yet
          setSuccessMessage(t("broker.planScheduled", { tier }));
        } else {
          // Upgrade applied immediately — wait for webhook, then refresh
          await new Promise((r) => setTimeout(r, 2000));
          setSuccessMessage(t("broker.planUpgraded", { tier }));
          try {
            const profileRes = await fetch("/api/brokers/profile");
            if (profileRes.ok) {
              const profile = await profileRes.json();
              setCurrentTier(profile.subscriptionTier || "FREE");
              setResponseCredits(profile.responseCredits ?? 0);
              if (profile.subscription) {
                setSubscription({
                  stripeSubscriptionId: profile.subscription.stripeSubscriptionId,
                  status: profile.subscription.status,
                  cancelAtPeriodEnd: profile.subscription.cancelAtPeriodEnd,
                  currentPeriodEnd: profile.subscription.currentPeriodEnd,
                  pendingTier: profile.subscription.pendingTier,
                });
              }
            }
          } catch {
            window.location.reload();
          }
        }
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Failed to initiate checkout:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setActionLoading("portal");
    posthog.capture("billing_portal_opened", { current_tier: currentTier });
    try {
      const res = await fetch("/api/stripe/create-portal", {
        method: "POST",
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      posthog.captureException(err);
      console.error("Failed to open portal:", err);
    } finally {
      setActionLoading(null);
    }
  };

  if (status === "loading" || isLoadingProfile) {
    return (
      <Layout>
        <Head><title>{t("titles.brokerBilling")}</title></Head>
        <SkeletonBilling />
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
      <Head><title>{t("titles.brokerBilling")}</title></Head>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10 ">
          <h1 className="heading-lg">{t("broker.billingTitle")}</h1>
          <p className="text-body mt-2">{t("broker.billingSubtitle")}</p>
        </div>

        {/* Success banner */}
        {successMessage && (
          <div className="mb-6  rounded-sm border-2 border-forest-300 bg-forest-50 p-4">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 text-forest-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <p className="font-body text-sm font-medium text-forest-700">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Payment failed banner */}
        {subscription?.status === "PAST_DUE" && (
          <div className="mb-6  rounded-sm border-2 border-error-300 bg-error-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 text-error-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <p className="font-body text-sm font-medium text-error-700">{t("broker.paymentFailed")}</p>
              </div>
              <button
                onClick={handleManageSubscription}
                disabled={actionLoading === "portal"}
                className="inline-flex items-center justify-center rounded-sm bg-error-600 px-4 py-2 font-body text-sm font-semibold text-white transition-all hover:bg-error-700 disabled:opacity-50"
              >
                {t("broker.updatePayment")}
              </button>
            </div>
          </div>
        )}

        {/* Cancelling banner */}
        {subscription?.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
          <div className="mb-6  rounded-sm border-2 border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <p className="font-body text-sm font-medium text-amber-700">
                {t("broker.cancellingAt", {
                  date: new Date(subscription.currentPeriodEnd).toLocaleDateString("en-CA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }),
                })}
              </p>
            </div>
          </div>
        )}

        {/* Pending downgrade banner */}
        {subscription?.pendingTier && subscription.currentPeriodEnd && (
          <div className="mb-6  rounded-sm border-2 border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <p className="font-body text-sm font-medium text-amber-700">
                {t("broker.pendingDowngrade", {
                  tier: subscription.pendingTier,
                  date: new Date(subscription.currentPeriodEnd).toLocaleDateString(
                    router.locale === "ko" ? "ko-KR" : "en-CA",
                    { year: "numeric", month: "long", day: "numeric" }
                  ),
                })}
              </p>
            </div>
          </div>
        )}

        {/* Current plan summary */}
        <div className="card-elevated mb-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="heading-sm">{t("broker.currentPlan")}</h2>
              <p className="text-body mt-1">
                {t("broker.currentPlanDesc", { tier: currentTier })}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-body text-xs font-medium uppercase tracking-wider text-forest-700/50">{t("broker.responseCredits")}</p>
                <p className={`font-display text-3xl tracking-tight ${responseCredits === 0 ? "text-error-600" : "text-amber-700"}`}>
                  {currentTier === "PREMIUM" ? t("broker.unlimited", "Unlimited") : responseCredits}
                </p>
              </div>
              {hasStripeSubscription && (
                <button
                  onClick={handleManageSubscription}
                  disabled={actionLoading === "portal"}
                  className="btn-secondary disabled:opacity-50"
                >
                  {actionLoading === "portal" ? t("broker.processing") : t("broker.manageSubscription")}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Plan comparison */}
        <h2 className="heading-md mb-6 ">{t("broker.choosePlan")}</h2>
        <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, i) => (
            <div
              key={plan.tier}
              className={`relative card-elevated flex flex-col ${
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
                {plan.originalPrice && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-body text-lg line-through text-sage-400">
                      {plan.originalPrice}
                    </span>
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold font-body bg-error-500 text-white">
                      {plan.discount} OFF
                    </span>
                  </div>
                )}
                <span className="font-display text-4xl tracking-tight text-forest-800">{plan.price}</span>
                <span className="text-body-sm">{plan.period}</span>
              </div>
              <p className="text-body-sm mt-1">{plan.credits}</p>
              <p className="text-body-sm mt-2 text-forest-700/60">{plan.description}</p>

              <hr className="divider my-6" />

              <ul className="space-y-3 flex-1">
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
                onClick={() => handleSelectPlan(plan.tier)}
                className={`mt-8 w-full flex items-center justify-center gap-2 ${
                  currentTier === plan.tier
                    ? "btn-secondary cursor-default opacity-60"
                    : plan.highlighted
                      ? "btn-amber"
                      : "btn-secondary"
                }`}
                disabled={currentTier === plan.tier || !!actionLoading}
              >
                {actionLoading === plan.tier && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {actionLoading === plan.tier
                  ? t("broker.processing")
                  : currentTier === plan.tier
                    ? t("broker.currentPlanBtn")
                    : (TIER_RANK[plan.tier] ?? 0) > (TIER_RANK[currentTier] ?? 0)
                      ? t("broker.upgrade")
                      : t("broker.downgrade", "Downgrade")}
              </button>
            </div>
          ))}
        </div>
        <p className="mt-8 mb-16 text-sm text-forest-700/60 font-body text-center">
          {t("pricing.creditExplanation")}
        </p>

        {/* Billing history */}
        <h2 className="heading-md mb-5 ">{t("broker.billingHistory")}</h2>
        {invoices.length > 0 ? (
          <div className="card-elevated !p-0 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-cream-300">
                  <th className="px-6 py-4 font-body text-xs font-semibold uppercase tracking-wider text-forest-700/50">{t("broker.invoiceDate")}</th>
                  <th className="px-6 py-4 font-body text-xs font-semibold uppercase tracking-wider text-forest-700/50">{t("broker.invoiceNumber")}</th>
                  <th className="px-6 py-4 font-body text-xs font-semibold uppercase tracking-wider text-forest-700/50">{t("broker.invoiceAmount")}</th>
                  <th className="px-6 py-4 font-body text-xs font-semibold uppercase tracking-wider text-forest-700/50">{t("broker.invoiceStatus")}</th>
                  <th className="px-6 py-4 font-body text-xs font-semibold uppercase tracking-wider text-forest-700/50">{t("broker.invoiceDownload")}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, index) => (
                  <tr key={inv.id} className={`border-b border-cream-200 ${index % 2 === 0 ? "bg-cream-50/50" : ""}`}>
                    <td className="px-6 py-3 font-body text-sm text-forest-700">{formatInvoiceDate(inv.created, router.locale || "ko")}</td>
                    <td className="px-6 py-3 font-body text-sm text-forest-700">{inv.number || "—"}</td>
                    <td className="px-6 py-3 font-body text-sm font-medium text-forest-800">{formatCurrency(inv.amountPaid, inv.currency)}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${
                        inv.status === "paid" ? "bg-forest-100 text-forest-700" : "bg-amber-100 text-amber-800"
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {inv.invoicePdf && (
                        <a
                          href={inv.invoicePdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-body text-sm font-medium text-forest-600 hover:text-forest-800 transition-colors"
                        >
                          {t("broker.invoiceDownload")}
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card-elevated py-16 text-center">
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
        )}
      </div>

      {/* Downgrade confirmation modal */}
      {downgradeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-forest-900/50 backdrop-blur-sm"
            onClick={() => !actionLoading && setDowngradeTarget(null)}
          />
          <div className="relative mx-4 w-full max-w-md rounded-sm bg-white p-8 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <h3 className="heading-sm">{t("broker.downgradeTitle")}</h3>
            <p className="text-body mt-2">
              {t("broker.confirmDowngrade", { tier: downgradeTarget })}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDowngradeTarget(null)}
                disabled={!!actionLoading}
                className="btn-secondary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("broker.cancel")}
              </button>
              <button
                onClick={() => executePlanChange(downgradeTarget)}
                disabled={!!actionLoading}
                className="flex-1 flex items-center justify-center gap-2 rounded-sm bg-amber-500 px-4 py-2.5 font-body text-sm font-semibold text-white transition-all hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === downgradeTarget && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {actionLoading === downgradeTarget ? t("broker.processing") : t("broker.confirmDowngradeBtn")}
              </button>
            </div>
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
