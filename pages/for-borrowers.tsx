import Link from "next/link";
import Head from "next/head";
import Layout from "@/components/Layout";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";

export default function ForBorrowers() {
  const { t } = useTranslation("common");

  const benefits = [
    {
      title: t("forBorrowers.benefit1Title"),
      description: t("forBorrowers.benefit1Desc"),
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: t("forBorrowers.benefit2Title"),
      description: t("forBorrowers.benefit2Desc"),
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
      ),
    },
    {
      title: t("forBorrowers.benefit3Title"),
      description: t("forBorrowers.benefit3Desc"),
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
    },
    {
      title: t("forBorrowers.benefit4Title"),
      description: t("forBorrowers.benefit4Desc"),
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
        </svg>
      ),
    },
  ];

  const steps = [
    {
      step: "01",
      title: t("forBorrowers.step1Title"),
      description: t("forBorrowers.step1Desc"),
    },
    {
      step: "02",
      title: t("forBorrowers.step2Title"),
      description: t("forBorrowers.step2Desc"),
    },
    {
      step: "03",
      title: t("forBorrowers.step3Title"),
      description: t("forBorrowers.step3Desc"),
    },
  ];

  return (
    <Layout>
      <Head>
        <title>For Borrowers — Find the Right Mortgage Broker | mortly</title>
        <meta
          name="description"
          content="Find the right mortgage broker for free. Submit an anonymous request, receive introductions from licensed brokers, and choose the best fit — no obligation."
        />
      </Head>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-forest-800 via-forest-900 to-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_60%,_theme(colors.amber.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-4xl mx-auto text-center">
          <span className="animate-fade-in-up opacity-0 stagger-1 inline-block px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-amber-400 border border-amber-400/30 rounded-full mb-8 font-body">
            {t("forBorrowers.badge")}
          </span>
          <h1 className="animate-fade-in-up opacity-0 stagger-2 font-display text-4xl sm:text-5xl lg:text-7xl tracking-tight text-cream-100 leading-[1.05]">
            {t("forBorrowers.title1")}
            <br />
            <em className="text-amber-300">{t("forBorrowers.title2")}</em>
          </h1>
          <p className="animate-fade-in-up opacity-0 stagger-3 mt-8 text-lg text-cream-300/70 leading-relaxed max-w-2xl mx-auto font-body">
            {t("forBorrowers.subtitle")}
          </p>
          <div className="animate-fade-in-up opacity-0 stagger-4 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup?role=borrower" className="btn-amber px-8 py-4 text-base">
              {t("forBorrowers.submitRequest")}
            </Link>
            <Link href="/how-it-works" className="inline-flex items-center justify-center rounded-lg border-2 border-cream-300/30 px-8 py-4 font-body text-sm font-semibold text-cream-200 transition-all duration-300 hover:bg-cream-100/10 hover:border-cream-300/50 active:scale-[0.98]">
              {t("forBorrowers.seeHowItWorks")}
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              {t("forBorrowers.whyBadge")}
            </span>
            <h2 className="heading-lg">{t("forBorrowers.whyTitle")}</h2>
            <p className="text-body mt-4">{t("forBorrowers.whySubtitle")}</p>
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
              { value: "100%", label: t("forBorrowers.statFree") },
              { value: t("forBorrowers.statAnonymousValue"), label: t("forBorrowers.statAnonymous") },
              { value: t("forBorrowers.statLicensedValue"), label: t("forBorrowers.statLicensed") },
              { value: "$0", label: t("forBorrowers.statNoCost") },
            ].map((stat, index) => (
              <div key={stat.label} className={`animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)}`}>
                <div className="font-display text-3xl sm:text-4xl text-amber-400">{stat.value}</div>
                <div className="mt-2 text-sm text-cream-300/60 font-body">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Preview */}
      <section className="section-padding bg-cream-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              {t("forBorrowers.howBadge")}
            </span>
            <h2 className="heading-lg">{t("forBorrowers.howTitle")}</h2>
            <p className="text-body mt-4">{t("forBorrowers.howSubtitle")}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div
                key={step.step}
                className={`text-center animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)}`}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-forest-800 text-amber-400 font-display text-2xl mb-6">
                  {step.step}
                </div>
                <h3 className="heading-sm mb-3">{step.title}</h3>
                <p className="text-body-sm">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/how-it-works" className="text-forest-700 font-body font-medium hover:text-forest-900 transition-colors">
              {t("forBorrowers.learnMore")} <span className="ml-1">&rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_70%_40%,_theme(colors.amber.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-3xl mx-auto text-center">
          <h2 className="animate-fade-in-up opacity-0 font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-cream-100">
            {t("forBorrowers.ctaTitle")}
          </h2>
          <p className="animate-fade-in-up opacity-0 stagger-1 mt-6 text-lg text-cream-300/70 font-body">
            {t("forBorrowers.ctaSubtitle")}
          </p>
          <Link
            href="/signup?role=borrower"
            className="animate-fade-in-up opacity-0 stagger-2 btn-amber mt-10 px-10 py-4 text-base"
          >
            {t("forBorrowers.ctaButton")}
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
