import Link from "next/link";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";

export default function Privacy() {
  const { t } = useTranslation("common");

  const protections = [
    {
      title: t("privacy.protection1Title"),
      description: t("privacy.protection1Desc"),
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2 2l20 20" />
        </svg>
      ),
    },
    {
      title: t("privacy.protection2Title"),
      description: t("privacy.protection2Desc"),
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      ),
    },
    {
      title: t("privacy.protection3Title"),
      description: t("privacy.protection3Desc"),
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
    {
      title: t("privacy.protection4Title"),
      description: t("privacy.protection4Desc"),
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
    },
  ];

  const dataCollected = [
    {
      category: t("privacy.data1Title"),
      items: [t("privacy.data1Item1"), t("privacy.data1Item2"), t("privacy.data1Item3"), t("privacy.data1Item4")],
      purpose: t("privacy.data1Purpose"),
    },
    {
      category: t("privacy.data2Title"),
      items: [t("privacy.data2Item1"), t("privacy.data2Item2"), t("privacy.data2Item3")],
      purpose: t("privacy.data2Purpose"),
    },
    {
      category: t("privacy.data3Title"),
      items: [t("privacy.data3Item1"), t("privacy.data3Item2"), t("privacy.data3Item3")],
      purpose: t("privacy.data3Purpose"),
    },
    {
      category: t("privacy.data4Title"),
      items: [t("privacy.data4Item1"), t("privacy.data4Item2"), t("privacy.data4Item3")],
      purpose: t("privacy.data4Purpose"),
    },
  ];

  const providers = [
    {
      title: t("privacy.provider1Title"),
      description: t("privacy.provider1Desc"),
    },
    {
      title: t("privacy.provider2Title"),
      description: t("privacy.provider2Desc"),
    },
    {
      title: t("privacy.provider3Title"),
      description: t("privacy.provider3Desc"),
    },
    {
      title: t("privacy.provider4Title"),
      description: t("privacy.provider4Desc"),
    },
    {
      title: t("privacy.provider5Title"),
      description: t("privacy.provider5Desc"),
    },
  ];

  const verificationSteps = [
    {
      step: "1",
      title: t("privacy.verify1"),
      description: t("privacy.verify1Desc"),
    },
    {
      step: "2",
      title: t("privacy.verify2"),
      description: t("privacy.verify2Desc"),
    },
    {
      step: "3",
      title: t("privacy.verify3"),
      description: t("privacy.verify3Desc"),
    },
    {
      step: "4",
      title: t("privacy.verify4"),
      description: t("privacy.verify4Desc"),
    },
  ];

  return (
    <Layout>
      <SEO title={t("privacy.headTitle")} description={t("privacy.metaDesc")} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-forest-800 via-forest-900 to-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_40%_40%,_theme(colors.sage.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-4xl mx-auto text-center">
          <div className="animate-fade-in-up opacity-0 stagger-1 mx-auto w-16 h-16 rounded-full bg-forest-700/50 border border-sage-400/20 text-amber-400 flex items-center justify-center mb-8">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="animate-fade-in-up opacity-0 stagger-2 font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight text-cream-100 leading-[1.1]">
            {t("privacy.heroTitle")}
          </h1>
          <p className="animate-fade-in-up opacity-0 stagger-3 mt-6 text-lg text-cream-300/70 leading-relaxed max-w-2xl mx-auto font-body">
            {t("privacy.heroDesc")}
          </p>
        </div>
      </section>

      {/* How Data Is Protected */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              {t("privacy.badge")}
            </span>
            <h2 className="heading-lg">{t("privacy.title")}</h2>
            <p className="text-body mt-4">{t("privacy.subtitle")}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {protections.map((item, index) => (
              <div
                key={item.title}
                className={`card-elevated animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)}`}
              >
                <div className="w-14 h-14 rounded-xl bg-forest-50 text-forest-600 flex items-center justify-center mb-6">
                  {item.icon}
                </div>
                <h3 className="heading-sm mb-3">{item.title}</h3>
                <p className="text-body-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What Data Is Collected */}
      <section className="section-padding bg-cream-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              {t("privacy.transparencyBadge")}
            </span>
            <h2 className="heading-lg">{t("privacy.transparencyTitle")}</h2>
            <p className="text-body mt-3">{t("privacy.transparencySubtitle")}</p>
          </div>

          <div className="space-y-6">
            {dataCollected.map((section, index) => (
              <div
                key={section.category}
                className={`card-elevated animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)}`}
              >
                <h3 className="heading-sm mb-5">{section.category}</h3>
                <ul className="space-y-2.5 mb-5">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-forest-700/80 font-body">
                      <span className="w-1.5 h-1.5 bg-forest-500 rounded-full flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="pt-5 border-t border-cream-200">
                  <p className="text-body-sm">
                    <strong className="text-forest-800 font-semibold">{t("privacy.purpose")}</strong> {section.purpose}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Service Providers */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              {t("privacy.providersBadge")}
            </span>
            <h2 className="heading-lg">{t("privacy.providersTitle")}</h2>
            <p className="text-body mt-4">{t("privacy.providersSubtitle")}</p>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {providers.map((provider, index) => (
              <div
                key={provider.title}
                className={`card-elevated animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)}`}
              >
                <h3 className="heading-sm mb-3">{provider.title}</h3>
                <p className="text-body-sm">{provider.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 animate-fade-in-up opacity-0 stagger-6 card-elevated !bg-forest-50 border-forest-200">
            <h3 className="heading-sm mb-3">{t("privacy.requestsTitle")}</h3>
            <p className="text-body-sm">
              {t("privacy.requestsDesc")}
              <a
                href="mailto:support@mortly.ca"
                className="font-semibold text-forest-700 underline underline-offset-2 hover:text-amber-600 transition-colors"
              >
                {t("privacy.reportDescEmail")}
              </a>
              {t("privacy.requestsDesc2")}
            </p>
          </div>
        </div>
      </section>

      {/* When Identity Is Shared */}
      <section className="section-padding bg-cream-50">
        <div className="max-w-4xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-16 items-start">
            <div className="lg:col-span-5 animate-fade-in-up opacity-0">
              <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
                {t("privacy.controlBadge")}
              </span>
              <h2 className="heading-lg mb-4">{t("privacy.controlTitle")}</h2>
              <p className="text-body">{t("privacy.controlSubtitle")}</p>
            </div>

            <div className="lg:col-span-7">
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-6 bottom-6 w-px bg-forest-200" />

                {/* Step: Anonymous */}
                <div className="relative flex gap-6 pb-10 animate-fade-in-up opacity-0 stagger-1">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-forest-100 text-forest-600 flex items-center justify-center z-10 ring-4 ring-cream-100">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="pt-1">
                    <h3 className="heading-sm mb-1">{t("privacy.step1Title")}</h3>
                    <p className="text-body-sm">{t("privacy.step1Desc")}</p>
                  </div>
                </div>

                {/* Step: Still Anonymous */}
                <div className="relative flex gap-6 pb-10 animate-fade-in-up opacity-0 stagger-2">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-forest-100 text-forest-600 flex items-center justify-center z-10 ring-4 ring-cream-100">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="pt-1">
                    <h3 className="heading-sm mb-1">{t("privacy.step2Title")}</h3>
                    <p className="text-body-sm">{t("privacy.step2Desc")}</p>
                  </div>
                </div>

                {/* Step: You Choose */}
                <div className="relative flex gap-6 animate-fade-in-up opacity-0 stagger-3">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center z-10 ring-4 ring-cream-100">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="pt-1">
                    <h3 className="heading-sm mb-1">{t("privacy.step3Title")}</h3>
                    <p className="text-body-sm">{t("privacy.step3Desc")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Broker Verification */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              {t("privacy.verificationBadge")}
            </span>
            <h2 className="heading-lg">{t("privacy.verificationTitle")}</h2>
            <p className="text-body mt-4">
              {t("privacy.verificationSubtitle")}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {verificationSteps.map((item, index) => (
              <div
                key={item.step}
                className={`card animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)} flex gap-5`}
              >
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-forest-800 text-amber-400 flex items-center justify-center font-display text-lg">
                    {item.step}
                  </div>
                </div>
                <div className="pt-1">
                  <h3 className="heading-sm mb-2">{item.title}</h3>
                  <p className="text-body-sm">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 animate-fade-in-up opacity-0 stagger-5 card-elevated !bg-forest-50 border-forest-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-forest-100 text-forest-600 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="heading-sm mb-1">{t("privacy.reportTitle")}</h4>
                <p className="text-body-sm">
                  {t("privacy.reportDesc")}
                  <a href="mailto:support@mortly.ca" className="font-semibold text-forest-700 underline underline-offset-2 hover:text-amber-600 transition-colors">
                    {t("privacy.reportDescEmail")}
                  </a>
                  {t("privacy.reportDesc2")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_50%,_theme(colors.sage.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-3xl mx-auto text-center">
          <h2 className="animate-fade-in-up opacity-0 font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-cream-100">
            {t("privacy.ctaTitle")}
          </h2>
          <p className="animate-fade-in-up opacity-0 stagger-1 mt-6 text-lg text-cream-300/70 font-body">
            {t("privacy.ctaDesc")}
          </p>
          <Link
            href="/borrower/request/new"
            className="animate-fade-in-up opacity-0 stagger-2 btn-amber mt-10 px-10 py-4 text-base"
          >
            {t("privacy.ctaButton")}
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
