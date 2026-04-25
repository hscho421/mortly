import Link from "next/link";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import LiveActivityMarquee from "@/components/LiveActivityMarquee";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { LiveRequest } from "@/types";
import type { InferGetStaticPropsType } from "next";
import { createHash } from "crypto";
import { PRODUCT_LABEL_KEYS } from "@/lib/requestConfig";

export default function Home({ liveRequests }: InferGetStaticPropsType<typeof getStaticProps>) {
  const { t } = useTranslation("common");
  return (
    <Layout>
      <SEO
        title={t("meta.homeTitle")}
        description={t("meta.homeDesc")}
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "mortly",
              url: "https://mortly.ca",
              logo: "https://mortly.ca/logo/favicon.svg",
              description: t("meta.homeDesc"),
            },
            {
              "@type": "WebSite",
              name: "mortly",
              url: "https://mortly.ca",
              inLanguage: ["ko", "en"],
              potentialAction: {
                "@type": "SearchAction",
                target: "https://mortly.ca/how-it-works",
              },
            },
          ],
        }}
      />

      {/* Hero Section — forest-dark editorial */}
      <section className="relative bg-forest-800 text-cream-100 overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
          <div className="grid lg:grid-cols-[1.3fr_1fr] gap-12 lg:gap-16 items-center">
            <div>
              <div className="eyebrow-dark animate-fade-in-up opacity-0 stagger-1">
                — {t("home.title1")}
              </div>
              <h1 className="animate-fade-in-up opacity-0 stagger-2 mt-6 font-display font-semibold text-3xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight text-cream-100 leading-[1.05]">
                {t("home.title1")}
                <br />
                <em className="italic text-amber-400 not-italic sm:italic">{t("home.title1Accent")}</em>
                <br />
                {t("home.title2")}
              </h1>
              <p className="animate-fade-in-up opacity-0 stagger-3 mt-8 text-base sm:text-lg text-cream-200/70 leading-relaxed max-w-xl font-body">
                {t("home.subtitle")}
                <br />
                {t("home.subtitle2")}
              </p>
              <div className="animate-fade-in-up opacity-0 stagger-4 mt-10 flex flex-col sm:flex-row items-start gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-sm bg-amber-500 px-7 py-3.5 font-body text-sm font-semibold text-white transition-all duration-200 hover:bg-amber-600 min-w-[180px]"
                >
                  {t("home.getStartedNow")} →
                </Link>
                <Link
                  href="/how-it-works"
                  className="inline-flex items-center justify-center rounded-sm border border-cream-300/25 px-7 py-3.5 font-body text-sm font-semibold text-cream-100 transition-all duration-200 hover:bg-cream-100/5 hover:border-cream-300/50 min-w-[180px]"
                >
                  {t("home.submitRequest")}
                </Link>
              </div>
              <div className="animate-fade-in-up opacity-0 stagger-5 mt-10 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] text-cream-200/50 tracking-[0.12em] uppercase">
                <span>✓ {t("home.social.stat4Label")}</span>
                <span>✓ {t("home.social.stat2Label")}</span>
                <span>✓ {t("home.social.stat3Label")}</span>
              </div>
            </div>

            {/* Marketplace summary card */}
            <div className="animate-fade-in-up opacity-0 stagger-5">
              <div className="rounded-sm border border-cream-100/10 bg-cream-100/[0.04] p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-amber-400">
                    ● {t("home.live.title")}
                  </div>
                  <div className="font-mono text-[11px] text-cream-200/50">
                    {liveRequests.length > 0 ? `LIVE · ${liveRequests.length} OPEN` : "LIVE"}
                  </div>
                </div>
                <div className="space-y-0">
                  {liveRequests.slice(0, 4).map((r, i) => {
                    const statusLabel = r.status === "IN_PROGRESS"
                      ? t("home.live.inProgress")
                      : t("home.live.seekingBroker");
                    return (
                      <div
                        key={r.key}
                        className={`grid grid-cols-[1.4fr_1fr_0.9fr] gap-3 py-3.5 items-center text-[13px] ${i ? "border-t border-cream-100/[0.06]" : ""}`}
                      >
                        <div className="text-cream-100 truncate">
                          {r.mortgageCategory === "COMMERCIAL" ? t("request.commercial") : t("request.residential")}
                          {r.productTypes?.[0] ? ` · ${t(PRODUCT_LABEL_KEYS[r.productTypes[0]] ?? r.productTypes[0])}` : ""}
                        </div>
                        <div className="text-cream-200/60 text-xs truncate">
                          {r.city ? `${r.city}, ` : ""}{r.province ?? ""}
                        </div>
                        <div className="text-right font-mono text-[10px] text-amber-400 uppercase tracking-[0.12em]">
                          {statusLabel}
                        </div>
                      </div>
                    );
                  })}
                  {liveRequests.length === 0 && (
                    <div className="py-8 text-center text-sm text-cream-200/40">
                      —
                    </div>
                  )}
                </div>

                {/* Stats grid */}
                <div className="mt-6 grid grid-cols-2 gap-4 pt-5 border-t border-cream-100/10">
                  {[
                    { v: t("home.social.stat1Value"), l: t("home.social.stat1Label") },
                    { v: t("home.social.stat2Value"), l: t("home.social.stat2Label") },
                    { v: t("home.social.stat3Value"), l: t("home.social.stat3Label") },
                    { v: t("home.social.stat4Value"), l: t("home.social.stat4Label") },
                  ].map((s, i) => (
                    <div key={i} className={i < 2 ? "pb-4 border-b border-cream-100/10" : ""}>
                      <div className="font-display text-3xl text-amber-400 leading-none">{s.v}</div>
                      <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-cream-200/50">
                        {s.l}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Request Activity — keep marquee for social proof */}
      {liveRequests && liveRequests.length > 0 && (
        <LiveActivityMarquee requests={liveRequests} />
      )}

      {/* How It Works — editorial 3-step */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 animate-fade-in-up opacity-0">
            <div className="eyebrow">— {t("home.theProcess")}</div>
            <h2 className="heading-lg mt-4 max-w-3xl">
              {t("home.threeSteps")}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { t: t("home.step1Title"), d: t("home.step1Desc") },
              { t: t("home.step2Title"), d: t("home.step2Desc") },
              { t: t("home.step3Title"), d: t("home.step3Desc") },
            ].map((step, i) => (
              <div
                key={i}
                className={`card-elevated animate-fade-in-up opacity-0 stagger-${i + 1}`}
              >
                <div className="font-display text-5xl italic text-amber-500 leading-none">
                  0{i + 1}
                </div>
                <div className="h-px bg-cream-300 my-5" />
                <h3 className="font-body text-base font-semibold text-forest-800 leading-snug">
                  {step.t}
                </h3>
                <p className="mt-2 text-body-sm">
                  {step.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Mortly — comparison */}
      <section className="section-padding bg-cream-50 border-y border-cream-300">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10 animate-fade-in-up opacity-0">
            <div className="eyebrow">— {t("home.whyUs")}</div>
            <h2 className="heading-lg mt-4 max-w-3xl">
              {t("home.builtOnTrust")}
            </h2>
            <p className="text-body mt-4 max-w-2xl">
              {t("home.trustDesc")}
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 lg:gap-5">
            <div className="card-elevated animate-fade-in-up opacity-0 stagger-1 flex gap-5">
              <div className="flex-shrink-0 w-12 h-12 rounded-sm bg-cream-200 text-forest-700 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="heading-sm mb-2">{t("home.privacyFirst")}</h3>
                <p className="text-body-sm">{t("home.privacyFirstDesc")}</p>
              </div>
            </div>

            <div className="card-elevated animate-fade-in-up opacity-0 stagger-2 flex gap-5">
              <div className="flex-shrink-0 w-12 h-12 rounded-sm bg-amber-50 text-amber-600 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <h3 className="heading-sm mb-2">{t("home.verifiedBrokers")}</h3>
                <p className="text-body-sm">{t("home.verifiedBrokersDesc")}</p>
              </div>
            </div>

            <div className="card-elevated animate-fade-in-up opacity-0 stagger-3 flex gap-5">
              <div className="flex-shrink-0 w-12 h-12 rounded-sm bg-cream-200 text-forest-700 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="heading-sm mb-2">{t("home.noCommitment")}</h3>
                <p className="text-body-sm">{t("home.noCommitmentDesc")}</p>
              </div>
            </div>

            <div className="card-elevated animate-fade-in-up opacity-0 stagger-4 flex gap-5">
              <div className="flex-shrink-0 w-12 h-12 rounded-sm bg-amber-50 text-amber-600 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3.75 18h4.5" />
                </svg>
              </div>
              <div>
                <h3 className="heading-sm mb-2">{t("home.mobileReady")}</h3>
                <p className="text-body-sm">{t("home.mobileReadyDesc")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-forest-800 text-cream-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
          <div className="grid lg:grid-cols-[2fr_1fr] gap-12 items-center">
            <div>
              <div className="eyebrow-dark">— {t("nav.getStarted")}</div>
              <h2 className="animate-fade-in-up opacity-0 mt-4 font-display font-semibold text-3xl sm:text-4xl lg:text-5xl tracking-tight text-cream-100">
                {t("home.readyTitle")}
              </h2>
              <p className="animate-fade-in-up opacity-0 stagger-1 mt-4 text-base sm:text-lg text-cream-200/70 font-body max-w-xl">
                {t("home.readyDesc")}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/borrower/request/new"
                className="animate-fade-in-up opacity-0 stagger-2 inline-flex items-center justify-center gap-2 rounded-sm bg-amber-500 px-8 py-4 font-body text-[15px] font-semibold text-white transition-all duration-200 hover:bg-amber-600"
              >
                {t("home.getStartedFree")} →
              </Link>
              <Link
                href="/signup?role=broker"
                className="animate-fade-in-up opacity-0 stagger-3 inline-flex items-center justify-center rounded-sm border border-cream-300/25 px-8 py-4 font-body text-[15px] font-semibold text-cream-100 transition-all duration-200 hover:bg-cream-100/5"
              >
                {t("forBrokers.signUpBroker")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="py-8 bg-cream-200/50 border-t border-cream-300">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs text-forest-700/75 text-center leading-relaxed font-body">
            <strong>Disclaimer:</strong> {t("home.disclaimerFull")}
          </p>
        </div>
      </section>
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

    liveRequests = rows.map((r: typeof rows[number]) => ({
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
