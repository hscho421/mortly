import { useState } from "react";
import Link from "next/link";
import Head from "next/head";
import Layout from "@/components/Layout";
import LiveActivityMarquee from "@/components/LiveActivityMarquee";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { LiveRequest } from "@/types";
import type { InferGetStaticPropsType } from "next";
import { createHash } from "crypto";

export default function Home({ liveRequests }: InferGetStaticPropsType<typeof getStaticProps>) {
  const { t } = useTranslation("common");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  return (
    <Layout>
      <Head>
        <title>mortly — Find Your Perfect Mortgage Broker Anonymously</title>
        <meta
          name="description"
          content="mortly is a privacy-first marketplace where borrowers anonymously share their mortgage needs and verified brokers compete to connect with them."
        />
      </Head>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-forest-800 via-forest-900 to-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_40%,_theme(colors.amber.400),_transparent_60%)]" />
        <div className="relative section-padding max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-6 lg:gap-12 items-center min-h-[70vh]">
            <div className="lg:col-span-7">
              <h1 className="animate-fade-in-up opacity-0 stagger-1 font-display text-3xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight text-cream-100 leading-[1.05]">
                {t("home.title1")} <span className="text-amber-300 whitespace-nowrap">{t("home.title1Accent")}</span> {t("home.title1After")}
                <br />
                {t("home.title2")}{t("home.title3") ? (<><br /><em className="text-amber-300">{t("home.title3")}</em></>) : null}<span className="text-cream-100">.</span>
              </h1>
              <p className="animate-fade-in-up opacity-0 stagger-3 mt-8 text-lg text-cream-300/80 leading-relaxed max-w-xl font-body">
                {t("home.subtitle")}
              </p>
              <div className="animate-fade-in-up opacity-0 stagger-4 mt-10 flex flex-col sm:flex-row items-start gap-4">
                <Link href="/login" className="btn-amber px-8 py-4 text-base min-w-[180px] text-center">
                  {t("home.getStartedNow")}
                </Link>
                <Link href="/how-it-works" className="inline-flex items-center justify-center rounded-lg border-2 border-cream-300/30 px-8 py-4 font-body text-base font-semibold text-cream-200 transition-all duration-300 hover:bg-cream-100/10 hover:border-cream-300/50 active:scale-[0.98] min-w-[180px] text-center">
                  {t("home.submitRequest")}
                </Link>
              </div>
            </div>
            <div className="lg:col-span-5 hidden lg:flex items-center justify-center">
              <div className="animate-scale-in opacity-0 stagger-5 relative">
                <div className="w-72 h-72 rounded-full border border-amber-400/20 flex items-center justify-center">
                  <div className="w-56 h-56 rounded-full border border-cream-300/10 flex items-center justify-center">
                    <div className="w-40 h-40 rounded-full bg-forest-700/50 flex items-center justify-center">
                      <svg className="w-16 h-16 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Request Activity */}
      {liveRequests && liveRequests.length > 0 && (
        <LiveActivityMarquee requests={liveRequests} />
      )}

      {/* How It Works */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              {t("home.theProcess")}
            </span>
            <h2 className="heading-lg sm:whitespace-nowrap">
              {t("home.threeSteps")}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-8 lg:gap-12">
            {/* Step 1 */}
            <div className="card animate-fade-in-up opacity-0 stagger-1">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-forest-800 text-amber-400 flex items-center justify-center font-display text-lg">
                  1
                </div>
                <div className="h-px flex-1 bg-cream-300" />
              </div>
              <h3 className="heading-sm mb-3">{t("home.step1Title")}</h3>
              <p className="text-body-sm">
                {t("home.step1Desc")}
              </p>
            </div>

            {/* Step 2 */}
            <div className="card animate-fade-in-up opacity-0 stagger-2">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-forest-800 text-amber-400 flex items-center justify-center font-display text-lg">
                  2
                </div>
                <div className="h-px flex-1 bg-cream-300" />
              </div>
              <h3 className="heading-sm mb-3">{t("home.step2Title")}</h3>
              <p className="text-body-sm">
                {t("home.step2Desc")}
              </p>
            </div>

            {/* Step 3 */}
            <div className="card animate-fade-in-up opacity-0 stagger-3">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-forest-800 text-amber-400 flex items-center justify-center font-display text-lg">
                  3
                </div>
                <div className="h-px flex-1 bg-cream-300" />
              </div>
              <h3 className="heading-sm mb-3">{t("home.step3Title")}</h3>
              <p className="text-body-sm">
                {t("home.step3Desc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="section-padding bg-cream-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-16 items-start">
            <div className="lg:col-span-4 animate-fade-in-up opacity-0">
              <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
                {t("home.whyUs")}
              </span>
              <h2 className="heading-lg mb-6">
                {t("home.builtOnTrust")}
              </h2>
              <p className="text-body">
                {t("home.trustDesc")}
              </p>
            </div>

            <div className="lg:col-span-8 space-y-6">
              {/* Privacy Shield */}
              <div className="card-elevated animate-fade-in-up opacity-0 stagger-1 flex gap-4 sm:gap-6">
                <div className="flex-shrink-0 w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-forest-50 text-forest-600 flex items-center justify-center">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h3 className="heading-sm mb-2">{t("home.privacyFirst")}</h3>
                  <p className="text-body-sm">
                    {t("home.privacyFirstDesc")}
                  </p>
                </div>
              </div>

              {/* Verified Brokers */}
              <div className="card-elevated animate-fade-in-up opacity-0 stagger-2 flex gap-4 sm:gap-6">
                <div className="flex-shrink-0 w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div>
                  <h3 className="heading-sm mb-2">{t("home.verifiedBrokers")}</h3>
                  <p className="text-body-sm">
                    {t("home.verifiedBrokersDesc")}
                  </p>
                </div>
              </div>

              {/* No Commitment */}
              <div className="card-elevated animate-fade-in-up opacity-0 stagger-3 flex gap-4 sm:gap-6">
                <div className="flex-shrink-0 w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-sage-50 text-sage-600 flex items-center justify-center">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="heading-sm mb-2">{t("home.noCommitment")}</h3>
                  <p className="text-body-sm">
                    {t("home.noCommitmentDesc")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof — Stats */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              {t("home.social.overline")}
            </span>
            <h2 className="heading-lg">{t("home.social.title")}</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {([
              { value: t("home.social.stat1Value"), label: t("home.social.stat1Label") },
              { value: t("home.social.stat2Value"), label: t("home.social.stat2Label") },
              { value: t("home.social.stat3Value"), label: t("home.social.stat3Label") },
              { value: t("home.social.stat4Value"), label: t("home.social.stat4Label") },
            ] as const).map((stat, i) => (
              <div
                key={i}
                className={`card-stat text-center animate-fade-in-up opacity-0 stagger-${i + 1}`}
              >
                <p className="font-display text-3xl sm:text-4xl text-forest-800 mb-2">
                  {stat.value === "0" ? (
                    <><span className="text-amber-500">$</span>0</>
                  ) : (
                    stat.value
                  )}
                </p>
                <p className="text-body-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Prop — Borrowers & Brokers */}
      <section className="section-padding bg-cream-50">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              {t("home.valueProp.overline")}
            </span>
            <h2 className="heading-lg">{t("home.valueProp.title")}</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 lg:gap-10">
            {/* Borrowers */}
            <div className="card-elevated animate-fade-in-up opacity-0 stagger-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <h3 className="heading-md">{t("home.valueProp.borrowerTitle")}</h3>
              </div>
              <ul className="space-y-4 mb-8">
                {[1, 2, 3, 4].map((n) => (
                  <li key={n} className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className="text-body-sm">{t(`home.valueProp.borrowerBullet${n}`)}</span>
                  </li>
                ))}
              </ul>
              <Link href="/login" className="btn-amber w-full text-center">
                {t("home.valueProp.borrowerCta")}
              </Link>
            </div>

            {/* Brokers */}
            <div className="card-elevated animate-fade-in-up opacity-0 stagger-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <h3 className="heading-md">{t("home.valueProp.brokerTitle")}</h3>
              </div>
              <ul className="space-y-4 mb-8">
                {[1, 2, 3, 4].map((n) => (
                  <li key={n} className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className="text-body-sm">{t(`home.valueProp.brokerBullet${n}`)}</span>
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="btn-primary w-full text-center">
                {t("home.valueProp.brokerCta")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-3xl mx-auto">
          <div className="mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              {t("home.faq.overline")}
            </span>
            <h2 className="heading-lg">{t("home.faq.title")}</h2>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="border border-cream-300 rounded-xl bg-white overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === n ? null : n)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left cursor-pointer"
                  aria-expanded={openFaq === n}
                >
                  <span className="heading-sm !text-base pr-4">{t(`home.faq.q${n}`)}</span>
                  <svg
                    className={`w-5 h-5 text-sage-500 flex-shrink-0 transition-transform duration-200 ${openFaq === n ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                <div
                  className={`grid transition-all duration-300 ${openFaq === n ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-5 text-body-sm">{t(`home.faq.a${n}`)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_70%_50%,_theme(colors.amber.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-4xl mx-auto text-center">
          <h2 className="animate-fade-in-up opacity-0 font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-cream-100">
            {t("home.readyTitle")}
          </h2>
          <p className="animate-fade-in-up opacity-0 stagger-1 mt-6 text-lg text-cream-300/70 font-body">
            {t("home.readyDesc")}
          </p>
          <Link
            href="/borrower/request/new"
            className="animate-fade-in-up opacity-0 stagger-2 btn-amber mt-10 px-10 py-4 text-base"
          >
            {t("home.getStartedFree")}
          </Link>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="pb-24 sm:pb-8 py-8 bg-cream-200/50 border-t border-cream-300">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs text-forest-700/75 text-center leading-relaxed font-body">
            <strong>Disclaimer:</strong> {t("home.disclaimerFull")}
          </p>
        </div>
      </section>

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-cream-50/95 backdrop-blur-md border-t border-cream-300 px-4 py-3">
        <Link href="/login" className="btn-amber w-full text-center py-3.5">
          {t("home.getStartedNow")}
        </Link>
      </div>
    </Layout>
  );
}

export const getStaticProps = async ({ locale }: { locale: string }) => {
  // Dynamic import to avoid bundling Prisma client-side
  const { default: prisma } = await import("@/lib/prisma");

  let liveRequests: LiveRequest[] = [];
  try {
    const rows = await prisma.borrowerRequest.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      select: {
        id: true,
        mortgageCategory: true,
        productTypes: true,
        province: true,
        city: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    liveRequests = rows.map((r) => ({
      key: createHash("sha256").update(r.id).digest("hex").slice(0, 8),
      mortgageCategory: r.mortgageCategory,
      productTypes: r.productTypes.slice(0, 2),
      province: r.province,
      city: r.city,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch {
    // If DB is unreachable during build, render without live data
  }

  return {
    props: {
      ...(await serverSideTranslations(locale ?? "ko", ["common"])),
      liveRequests,
    },
    revalidate: 300,
  };
};
