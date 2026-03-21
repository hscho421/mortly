import Link from "next/link";
import Head from "next/head";
import Layout from "@/components/Layout";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";

export default function ForBrokers() {
  const { t } = useTranslation("common");

  const tiers = [
    {
      name: t("pricing.freeName"),
      price: "$0",
      period: "",
      description: t("pricing.freeDesc"),
      features: [
        t("pricing.val_standardListing"),
        t("pricing.feat_introductions") + ": " + t("pricing.val_none"),
      ],
      cta: t("pricing.freeCta"),
      featured: false,
    },
    {
      name: t("pricing.basicName"),
      price: "$49",
      period: t("pricing.perMonth"),
      description: t("pricing.basicDesc"),
      features: [
        t("pricing.val_5perMonth"),
        t("pricing.val_standardListing"),
        t("pricing.feat_notifications"),
        t("pricing.val_emailSupport"),
      ],
      cta: t("pricing.basicCta"),
      featured: false,
    },
    {
      name: t("pricing.proName"),
      price: "$149",
      period: t("pricing.perMonth"),
      description: t("pricing.proDesc"),
      features: [
        t("pricing.val_20perMonth"),
        t("pricing.val_priority") + " " + t("pricing.feat_placement").toLowerCase(),
        t("pricing.val_enhancedListing"),
        t("pricing.feat_leadFilters"),
        t("pricing.val_prioritySupport"),
      ],
      cta: t("pricing.proCta"),
      featured: true,
    },
    {
      name: t("pricing.premiumName"),
      price: "$349",
      period: t("pricing.perMonth"),
      description: t("pricing.premiumDesc"),
      features: [
        t("pricing.val_unlimited"),
        t("pricing.feat_badge"),
        t("pricing.val_topOfResults"),
        t("pricing.feat_accountManager"),
        t("pricing.feat_analytics"),
        t("pricing.feat_teamTools"),
      ],
      cta: t("pricing.premiumCta"),
      featured: false,
    },
  ];

  const benefits = [
    {
      title: t("forBrokers.benefit1Title"),
      description: t("forBrokers.benefit1Desc"),
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: t("forBrokers.benefit2Title"),
      description: t("forBrokers.benefit2Desc"),
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
    },
    {
      title: t("forBrokers.benefit3Title"),
      description: t("forBrokers.benefit3Desc"),
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      title: t("forBrokers.benefit4Title"),
      description: t("forBrokers.benefit4Desc"),
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
    },
  ];

  return (
    <Layout>
      <Head>
        <title>For Brokers — Grow Your Mortgage Business | mortly</title>
        <meta
          name="description"
          content="Join mortly to connect with qualified borrowers actively seeking mortgage brokers. Merit-based, transparent, and cost-effective."
        />
      </Head>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-forest-800 via-forest-900 to-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_70%_40%,_theme(colors.amber.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-4xl mx-auto text-center">
          <span className="animate-fade-in-up opacity-0 stagger-1 inline-block px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-amber-400 border border-amber-400/30 rounded-full mb-8 font-body">
            {t("forBrokers.badge")}
          </span>
          <h1 className="animate-fade-in-up opacity-0 stagger-2 font-display text-4xl sm:text-5xl lg:text-7xl tracking-tight text-cream-100 leading-[1.05]">
            {t("forBrokers.title1")}
            <br />
            <em className="text-amber-300">{t("forBrokers.title2")}</em>
          </h1>
          <p className="animate-fade-in-up opacity-0 stagger-3 mt-8 text-lg text-cream-300/70 leading-relaxed max-w-2xl mx-auto font-body">
            {t("forBrokers.subtitle")}
          </p>
          <div className="animate-fade-in-up opacity-0 stagger-4 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/pricing" className="btn-amber px-8 py-4 text-base">
              {t("forBrokers.viewPricing")}
            </Link>
            <Link href="/how-it-works" className="inline-flex items-center justify-center rounded-lg border-2 border-cream-300/30 px-8 py-4 font-body text-sm font-semibold text-cream-200 transition-all duration-300 hover:bg-cream-100/10 hover:border-cream-300/50 active:scale-[0.98]">
              {t("forBrokers.seeHowItWorks")}
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              {t("forBrokers.advantageBadge")}
            </span>
            <h2 className="heading-lg">{t("forBrokers.advantageTitle")}</h2>
            <p className="text-body mt-4">{t("forBrokers.advantageSubtitle")}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {benefits.map((benefit, index) => (
              <div
                key={benefit.title}
                className={`card-elevated animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)}`}
              >
                <div className="w-14 h-14 rounded-xl bg-forest-50 text-forest-600 flex items-center justify-center mb-6">
                  {benefit.icon}
                </div>
                <h3 className="heading-sm mb-3">{benefit.title}</h3>
                <p className="text-body-sm">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-forest-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 text-center">
            {[
              { value: "93%", label: t("forBrokers.satisfactionRate") },
              { value: "4.8x", label: t("forBrokers.roiVsAds") },
              { value: "72hr", label: t("forBrokers.avgResponseTime") },
              { value: "100%", label: t("forBrokers.activeMarkets") },
            ].map((stat, index) => (
              <div key={stat.label} className={`animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)}`}>
                <div className="font-display text-3xl sm:text-4xl text-amber-400">{stat.value}</div>
                <div className="mt-2 text-sm text-cream-300/60 font-body">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="section-padding bg-cream-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              {t("forBrokers.investmentBadge")}
            </span>
            <h2 className="heading-lg">{t("forBrokers.pricingTitle")}</h2>
            <p className="text-body mt-4">{t("forBrokers.pricingSubtitle")}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {tiers.map((tier, index) => (
              <div
                key={tier.name}
                className={`animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)} rounded-2xl p-8 flex flex-col transition-all duration-300 ${
                  tier.featured
                    ? "bg-forest-800 text-cream-100 ring-2 ring-amber-400 relative scale-[1.02]"
                    : "card"
                }`}
              >
                {tier.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-400 text-forest-900 text-xs font-bold rounded-full uppercase tracking-wider font-body">
                    {t("forBrokers.mostPopular")}
                  </div>
                )}
                <h3 className={`font-body text-sm font-semibold uppercase tracking-wider ${tier.featured ? "text-amber-400" : "text-sage-500"}`}>
                  {tier.name}
                </h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className={`font-display text-4xl ${tier.featured ? "text-cream-100" : "text-forest-800"}`}>
                    {tier.price}
                  </span>
                  <span className={`font-body text-sm ${tier.featured ? "text-cream-300/60" : "text-sage-400"}`}>
                    {tier.period}
                  </span>
                </div>
                <p className={`mt-3 text-body-sm ${tier.featured ? "!text-cream-300/70" : ""}`}>
                  {tier.description}
                </p>
                <ul className="mt-6 space-y-3 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm font-body">
                      <svg
                        className={`w-5 h-5 flex-shrink-0 ${tier.featured ? "text-amber-400" : "text-forest-500"}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className={tier.featured ? "text-cream-200" : "text-forest-700/80"}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/pricing"
                  className={`mt-8 block text-center w-full py-3 rounded-lg font-semibold text-sm transition-all duration-300 font-body ${
                    tier.featured
                      ? "bg-amber-400 text-forest-900 hover:bg-amber-300"
                      : "btn-primary"
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/pricing" className="text-forest-700 font-body font-medium hover:text-forest-900 transition-colors">
              View full pricing details <span className="ml-1">&rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_60%,_theme(colors.amber.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-3xl mx-auto text-center">
          <h2 className="animate-fade-in-up opacity-0 font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-cream-100">
            {t("forBrokers.ctaTitle")}
          </h2>
          <p className="animate-fade-in-up opacity-0 stagger-1 mt-6 text-lg text-cream-300/70 font-body">
            {t("forBrokers.ctaSubtitle")}
          </p>
          <Link
            href="/pricing"
            className="animate-fade-in-up opacity-0 stagger-2 btn-amber mt-10 px-10 py-4 text-base"
          >
            {t("forBrokers.signUpBroker")}
          </Link>
        </div>
      </section>
    </Layout>
  );
}

export const getStaticProps = async ({ locale }: { locale: string }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});
