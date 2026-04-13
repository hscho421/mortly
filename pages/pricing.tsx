import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";

function CellValue({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <svg className="w-5 h-5 text-forest-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ) : (
      <svg className="w-5 h-5 text-cream-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  return <span className="text-sm text-forest-700/80 font-body">{value}</span>;
}

export default function Pricing() {
  const { t } = useTranslation("common");
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.replace("/signup?role=broker", undefined, { locale: router.locale });
      return;
    }
    if (session.user.role === "BORROWER") {
      router.replace("/borrower/dashboard", undefined, { locale: router.locale });
    }
  }, [session, status, router]);

  const goToBilling = () => {
    router.push("/broker/billing", undefined, { locale: router.locale });
  };

  if (status === "loading" || !session || session.user.role === "BORROWER") {
    return null;
  }

  const tiers = [
    {
      tier: "FREE",
      name: t("pricing.freeName"),
      price: "$0",
      originalPrice: null,
      discount: null,
      period: "",
      description: t("pricing.freeDesc"),
      features: {
        responses: t("pricing.val_none"),
        notifications: false,
        realtimeAlerts: false,
      },
      cta: t("pricing.freeCta"),
      featured: false,
    },
    {
      tier: "BASIC",
      name: t("pricing.basicName"),
      price: "$29",
      originalPrice: "$49",
      discount: "41%",
      period: t("pricing.perMonth"),
      description: t("pricing.basicDesc"),
      features: {
        responses: t("pricing.val_5perMonth"),
        notifications: false,
        realtimeAlerts: false,
      },
      cta: t("pricing.basicCta"),
      featured: false,
    },
    {
      tier: "PRO",
      name: t("pricing.proName"),
      price: "$69",
      originalPrice: "$99",
      discount: "30%",
      period: t("pricing.perMonth"),
      description: t("pricing.proDesc"),
      features: {
        responses: t("pricing.val_20perMonth"),
        notifications: true,
        realtimeAlerts: false,
      },
      cta: t("pricing.proCta"),
      featured: true,
    },
    {
      tier: "PREMIUM",
      name: t("pricing.premiumName"),
      price: "$129",
      originalPrice: "$199",
      discount: "35%",
      period: t("pricing.perMonth"),
      description: t("pricing.premiumDesc"),
      features: {
        responses: t("pricing.val_unlimited"),
        notifications: true,
        realtimeAlerts: true,
      },
      cta: t("pricing.premiumCta"),
      featured: false,
    },
  ];

  const comparisonRows = [
    { label: t("pricing.feat_responses"), key: "responses" },
    { label: t("pricing.feat_notifications"), key: "notifications" },
    { label: t("pricing.feat_realtimeAlerts"), key: "realtimeAlerts" },
  ];

  const faqs = [
    {
      q: t("pricing.faq1Q"),
      a: t("pricing.faq1A"),
    },
    {
      q: t("pricing.faq2Q"),
      a: t("pricing.faq2A"),
    },
    {
      q: t("pricing.faq4Q"),
      a: t("pricing.faq4A"),
    },
    {
      q: t("pricing.faq5Q"),
      a: t("pricing.faq5A"),
    },
  ];

  return (
    <Layout>
      <SEO title={t("meta.pricingTitle")} description={t("meta.pricingDesc")} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-forest-800 via-forest-900 to-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_30%,_theme(colors.amber.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-3xl mx-auto text-center">
          <span className="animate-fade-in-up opacity-0 stagger-1 inline-block font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-400 mb-6">
            {t("pricing.badge")}
          </span>
          <h1 className="animate-fade-in-up opacity-0 stagger-2 font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight text-cream-100 leading-[1.1]">
            {t("pricing.title")}
          </h1>
          <p className="animate-fade-in-up opacity-0 stagger-3 mt-6 text-lg text-cream-300/70 leading-relaxed font-body">
            {t("pricing.subtitle")} <br />
            {t("pricing.subtitle2")}
          </p>
          
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {tiers.map((tier, index) => (
              <div
                key={tier.name}
                className={`animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)} rounded-2xl p-8 flex flex-col transition-all duration-300 ${
                  tier.featured
                    ? "bg-forest-800 text-cream-100 ring-2 ring-amber-400 relative scale-[1.02] min-h-[480px]"
                    : "card-elevated min-h-[480px]"
                }`}
              >
                {tier.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-400 text-forest-900 text-xs font-bold rounded-full uppercase tracking-wider font-body">
                    {t("pricing.mostPopular")}
                  </div>
                )}
                <h3 className={`font-body text-sm font-semibold uppercase tracking-wider ${tier.featured ? "text-amber-400" : "text-sage-500"}`}>
                  {tier.name}
                </h3>
                <div className="mt-4">
                  {tier.originalPrice && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-body text-lg line-through ${tier.featured ? "text-cream-300/40" : "text-sage-400"}`}>
                        {tier.originalPrice}
                      </span>
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold font-body bg-rose-500 text-white">
                        {tier.discount} {t("misc.off")}
                      </span>
                    </div>
                  )}
                  <div className="flex items-baseline gap-1">
                    <span className={`font-display text-4xl sm:text-5xl ${tier.featured ? "text-cream-100" : "text-forest-800"}`}>
                      {tier.price}
                    </span>
                    <span className={`font-body text-sm ${tier.featured ? "text-cream-300/60" : "text-sage-400"}`}>
                      {tier.period}
                    </span>
                  </div>
                </div>
                <p className={`mt-3 text-sm font-body ${tier.featured ? "text-cream-300/70" : "text-forest-700/60"}`}>
                  {tier.description}
                </p>

                <ul className="mt-8 space-y-3 flex-1">
                  {Object.entries(tier.features).map(([key, value]) => {
                    if (typeof value === "boolean" && !value) return null;
                    const row = comparisonRows.find((r) => r.key === key);
                    const displayValue = typeof value === "boolean" ? row?.label : `${row?.label}: ${value}`;
                    return (
                      <li key={key} className="flex items-start gap-2.5 text-sm font-body">
                        <svg
                          className={`w-5 h-5 flex-shrink-0 mt-0.5 ${tier.featured ? "text-amber-400" : "text-forest-500"}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className={tier.featured ? "text-cream-200" : "text-forest-700/80"}>{displayValue}</span>
                      </li>
                    );
                  })}
                </ul>

                <button
                  onClick={goToBilling}
                  className={`mt-8 block text-center w-full py-3.5 rounded-lg font-semibold text-sm transition-all duration-300 font-body ${
                    tier.featured
                      ? "bg-amber-400 text-forest-900 hover:bg-amber-300"
                      : "bg-forest-800 text-cream-100 hover:bg-forest-700"
                  }`}
                >
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-forest-700/60 font-body text-center animate-fade-in-up opacity-0 stagger-5">
            {t("pricing.creditExplanation")}
          </p>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="section-padding bg-cream-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              {t("pricing.compareBadge")}
            </span>
            <h2 className="heading-lg">{t("pricing.compareTitle")}</h2>
            <p className="text-body mt-3">{t("pricing.compareSubtitle")}</p>
          </div>

          <div className="animate-fade-in-up opacity-0 stagger-2 overflow-x-auto card-elevated !p-0">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-cream-300">
                  <th className="py-4 sm:py-5 pl-4 sm:pl-6 pr-3 sm:pr-4 text-xs sm:text-sm font-semibold text-forest-800 min-w-[120px] font-body">{t("pricing.feature")}</th>
                  {tiers.map((tier) => (
                    <th key={tier.name} className="py-5 px-4 text-center">
                      <span className={`text-sm font-semibold font-body ${tier.featured ? "text-forest-800" : "text-forest-700"}`}>
                        {tier.name}
                      </span>
                      {tier.featured && (
                        <span className="block text-xs text-amber-600 font-body mt-0.5">{t("pricing.recommended")}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, index) => (
                  <tr key={row.key} className={`border-b border-cream-200 ${index % 2 === 0 ? "bg-cream-50/50" : ""}`}>
                    <td className="py-3 sm:py-4 pl-4 sm:pl-6 pr-3 sm:pr-4 text-xs sm:text-sm text-forest-700/80 font-body">{row.label}</td>
                    {tiers.map((tier) => (
                      <td key={tier.name} className="py-4 px-4 text-center">
                        <CellValue value={tier.features[row.key as keyof typeof tier.features]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              {t("pricing.faqBadge")}
            </span>
            <h2 className="heading-lg">{t("pricing.faqTitle")}</h2>
          </div>

          <div className="space-y-0">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)} border-b border-cream-300 py-8 first:pt-0 last:border-0`}
              >
                <h3 className="heading-sm mb-3">{faq.q}</h3>
                <p className="text-body">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_70%_50%,_theme(colors.amber.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-3xl mx-auto text-center">
          <h2 className="animate-fade-in-up opacity-0 font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-cream-100">
            {t("pricing.ctaTitle")}
          </h2>
          <p className="animate-fade-in-up opacity-0 stagger-1 mt-6 text-lg text-cream-300/70 font-body">
            {t("pricing.ctaSubtitle")}
          </p>
          <Link
            href="/for-brokers"
            className="animate-fade-in-up opacity-0 stagger-2 btn-amber mt-10 px-10 py-4 text-base"
          >
            {t("pricing.startFreeTrial")}
          </Link>
        </div>
      </section>
    </Layout>
  );
}

export const getStaticProps = async ({ locale }: { locale: string }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});
