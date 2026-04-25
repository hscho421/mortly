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

      {/* Hero — editorial cream with serif */}
      <section className="bg-cream-100 border-b border-cream-300">
        <div className="relative max-w-5xl mx-auto px-4 py-20 sm:px-6 lg:px-8 lg:py-24 text-center">
          <div className="eyebrow animate-fade-in-up opacity-0 stagger-1">— {t("pricing.badge")}</div>
          <h1 className="animate-fade-in-up opacity-0 stagger-2 mt-4 heading-lg">
            {t("pricing.title")}
          </h1>
          <p className="animate-fade-in-up opacity-0 stagger-3 mt-6 text-base sm:text-lg text-forest-700/70 leading-relaxed font-body max-w-2xl mx-auto">
            {t("pricing.subtitle")} {t("pricing.subtitle2")}
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="bg-cream-100 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {tiers.map((tier, index) => (
              <div
                key={tier.name}
                className={`animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)} rounded-sm p-7 flex flex-col transition-all duration-200 relative border bg-cream-50 ${
                  tier.featured
                    ? "border-amber-500 border-2"
                    : "border-cream-300"
                }`}
              >
                {tier.featured && (
                  <div className="mb-4 self-start badge-accent">
                    {t("pricing.mostPopular")}
                  </div>
                )}
                <h3 className="mono-label">
                  {tier.name}
                </h3>
                <div className="mt-3">
                  {tier.originalPrice && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-body text-sm line-through text-sage-400">
                        {tier.originalPrice}
                      </span>
                      <span className="inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-bold font-mono bg-red-50 text-red-600 border border-red-100">
                        {tier.discount} {t("misc.off")}
                      </span>
                    </div>
                  )}
                  <div className="flex items-baseline gap-1">
                    <span className="font-display font-semibold text-4xl sm:text-5xl tracking-[-0.03em] text-forest-800">
                      {tier.price}
                    </span>
                    <span className="font-body text-sm text-sage-400">
                      {tier.period}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm font-body text-forest-700/70 leading-relaxed">
                  {tier.description}
                </p>

                <div className="h-px bg-cream-300 my-6" />

                <ul className="space-y-2.5 flex-1">
                  {Object.entries(tier.features).map(([key, value]) => {
                    if (typeof value === "boolean" && !value) return null;
                    const row = comparisonRows.find((r) => r.key === key);
                    const displayValue = typeof value === "boolean" ? row?.label : `${row?.label}: ${value}`;
                    return (
                      <li key={key} className="flex items-start gap-2.5 text-[13px] font-body">
                        <span className="font-mono text-amber-600 leading-6">✓</span>
                        <span className="text-forest-700">{displayValue}</span>
                      </li>
                    );
                  })}
                </ul>

                <button
                  onClick={goToBilling}
                  className={`mt-6 block text-center w-full py-3 rounded-sm font-semibold text-sm transition-all duration-200 font-body ${
                    tier.featured
                      ? "bg-amber-500 text-white hover:bg-amber-600"
                      : "bg-forest-800 text-cream-100 hover:bg-forest-700"
                  }`}
                >
                  {tier.cta} →
                </button>
              </div>
            ))}
          </div>
          <p className="mt-10 text-sm text-forest-700/60 font-body text-center animate-fade-in-up opacity-0 stagger-5 max-w-3xl mx-auto">
            {t("pricing.creditExplanation")}
          </p>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="bg-cream-50 border-y border-cream-300 py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 animate-fade-in-up opacity-0">
            <div className="eyebrow">— {t("pricing.compareBadge")}</div>
            <h2 className="heading-lg mt-4">{t("pricing.compareTitle")}</h2>
            <p className="text-body mt-3 max-w-2xl">{t("pricing.compareSubtitle")}</p>
          </div>

          <div className="animate-fade-in-up opacity-0 stagger-2 overflow-x-auto rounded-sm border border-cream-300 bg-cream-50">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-cream-300 bg-cream-100">
                  <th className="py-4 pl-6 pr-4 mono-label min-w-[140px]">{t("pricing.feature")}</th>
                  {tiers.map((tier) => (
                    <th key={tier.name} className="py-4 px-4 text-center">
                      <span className="font-body text-sm font-semibold text-forest-800">
                        {tier.name}
                      </span>
                      {tier.featured && (
                        <span className="block text-[10px] text-amber-600 font-mono mt-1 uppercase tracking-[0.1em]">{t("pricing.recommended")}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.key} className="border-b border-cream-200 last:border-0">
                    <td className="py-4 pl-6 pr-4 text-sm text-forest-700 font-body">{row.label}</td>
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
      <section className="bg-cream-100 py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 animate-fade-in-up opacity-0">
            <div className="eyebrow">— {t("pricing.faqBadge")}</div>
            <h2 className="heading-lg mt-4">{t("pricing.faqTitle")}</h2>
          </div>

          <div>
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)} grid grid-cols-[40px_1fr] gap-5 border-t border-cream-300 py-6 first:border-t-0 first:pt-0`}
              >
                <div className="font-mono text-xs text-sage-500 pt-1">0{index + 1}</div>
                <div>
                  <h3 className="font-body text-base font-semibold text-forest-800 leading-snug">{faq.q}</h3>
                  <p className="text-body-sm mt-2">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-forest-800 text-cream-100">
        <div className="max-w-5xl mx-auto px-4 py-16 lg:py-20 sm:px-6 lg:px-8 text-center">
          <div className="eyebrow-dark">— {t("nav.getStarted")}</div>
          <h2 className="animate-fade-in-up opacity-0 mt-4 font-display font-semibold text-3xl sm:text-4xl lg:text-5xl tracking-tight text-cream-100">
            {t("pricing.ctaTitle")}
          </h2>
          <p className="animate-fade-in-up opacity-0 stagger-1 mt-5 text-base sm:text-lg text-cream-200/70 font-body">
            {t("pricing.ctaSubtitle")}
          </p>
          <Link
            href="/for-brokers"
            className="animate-fade-in-up opacity-0 stagger-2 inline-flex items-center justify-center gap-2 mt-8 rounded-sm bg-amber-500 px-8 py-3.5 font-body text-[15px] font-semibold text-white transition-all duration-200 hover:bg-amber-600"
          >
            {t("pricing.startFreeTrial")} →
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
