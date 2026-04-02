import Link from "next/link";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";

export default function HowItWorks() {
  const { t } = useTranslation("common");

  const borrowerSteps = [
    {
      number: "1",
      title: t("howItWorks.bStep1Title"),
      description: t("howItWorks.bStep1Desc"),
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
    },
    {
      number: "2",
      title: t("howItWorks.bStep2Title"),
      description: t("howItWorks.bStep2Desc"),
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
    },
    {
      number: "3",
      title: t("howItWorks.bStep3Title"),
      description: t("howItWorks.bStep3Desc"),
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      number: "4",
      title: t("howItWorks.bStep4Title"),
      description: t("howItWorks.bStep4Desc"),
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
  ];

  const faqs = [
    {
      q: t("howItWorks.faq1Q"),
      a: t("howItWorks.faq1A"),
    },
    {
      q: t("howItWorks.faq2Q"),
      a: t("howItWorks.faq2A"),
    },
    {
      q: t("howItWorks.faq3Q"),
      a: t("howItWorks.faq3A"),
    },
    {
      q: t("howItWorks.faq4Q"),
      a: t("howItWorks.faq4A"),
    },
    {
      q: t("howItWorks.faq5Q"),
      a: t("howItWorks.faq5A"),
    },
  ];

  return (
    <Layout>
      <SEO title={t("meta.howItWorksTitle")} description={t("meta.howItWorksDesc")} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-forest-800 via-forest-900 to-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_60%_30%,_theme(colors.sage.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-4xl mx-auto text-center">
          <span className="animate-fade-in-up opacity-0 stagger-1 inline-block font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-400 mb-6">
            {t("howItWorks.badge")}
          </span>
          <h1 className="animate-fade-in-up opacity-0 stagger-2 font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight text-cream-100 leading-[1.1]">
            {t("howItWorks.title")}
          </h1>
          <p className="animate-fade-in-up opacity-0 stagger-3 mt-6 text-lg text-cream-300/70 leading-relaxed max-w-2xl mx-auto font-body">
            {t("howItWorks.subtitle")}
          </p>
        </div>
      </section>

      {/* Borrower Flow */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16 animate-fade-in-up opacity-0">
            <span className="inline-block px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-forest-700 bg-forest-100 rounded-full mb-5 font-body">
              {t("howItWorks.forBorrowers")}
            </span>
            <h2 className="heading-lg">{t("howItWorks.borrowerTitle")}</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {borrowerSteps.map((step, index) => (
              <div
                key={step.number}
                className={`card animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)}`}
              >
                <div className="flex items-start gap-5">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-forest-800 text-amber-400 flex items-center justify-center font-display text-lg">
                      {step.number}
                    </div>
                  </div>
                  <div className="pt-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-forest-600">{step.icon}</span>
                      <h3 className="heading-sm">{step.title}</h3>
                    </div>
                    <p className="text-body-sm">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              {t("howItWorks.faqBadge")}
            </span>
            <h2 className="heading-lg">{t("howItWorks.faqTitle")}</h2>
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

          <div className="mt-12 text-center animate-fade-in-up opacity-0">
            <p className="text-body text-sage-500">
              {t("howItWorks.moreQuestions")}{" "}
              <a href="mailto:support@mortly.ca" className="text-forest-700 font-medium hover:text-forest-900 underline underline-offset-2 transition-colors">
                support@mortly.ca
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_60%,_theme(colors.amber.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-3xl mx-auto text-center">
          <h2 className="animate-fade-in-up opacity-0 font-display text-3xl sm:text-4xl tracking-tight text-cream-100">
            {t("howItWorks.readyTitle")}
          </h2>
          <p className="animate-fade-in-up opacity-0 stagger-1 mt-6 text-lg text-cream-300/70 font-body">
            {t("howItWorks.readyDesc")}
          </p>
          <div className="animate-fade-in-up opacity-0 stagger-2 mt-10">
            <Link href="/borrower/request/new" className="btn-amber px-8 py-4 text-base">
              {t("howItWorks.submitRequest")}
            </Link>
          </div>
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
