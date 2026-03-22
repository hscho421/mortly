import Link from "next/link";
import Head from "next/head";
import Layout from "@/components/Layout";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";

export default function ForBrokers() {
  const { t } = useTranslation("common");

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
            <br />
            {t("forBrokers.subtitle2")}
          </p>
          <div className="animate-fade-in-up opacity-0 stagger-4 mt-10">
            <Link href="/signup?role=broker" className="btn-amber px-8 py-4 text-base">
              {t("forBrokers.signUpBroker")}
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


      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_60%,_theme(colors.amber.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-3xl mx-auto text-center">
          <h2 className="animate-fade-in-up opacity-0 font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-cream-100">
            {t("forBrokers.ctaTitle1")}<span className="text-amber-400">{t("forBrokers.ctaAccent")}</span>{t("forBrokers.ctaTitle2")}
          </h2>
          <p className="animate-fade-in-up opacity-0 stagger-1 mt-6 text-lg text-cream-300/70 font-body">
            {t("forBrokers.ctaSubtitle")}
          </p>
          <Link
            href="/signup?role=broker"
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
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});
