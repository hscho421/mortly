import Link from "next/link";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";

export default function Contact() {
  const { t } = useTranslation("common");

  return (
    <Layout>
      <SEO
        title={t("contact.metaTitle")}
        description={t("contact.metaDesc")}
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-forest-800 via-forest-900 to-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_60%,_theme(colors.amber.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-4xl mx-auto text-center">
          <span className="animate-fade-in-up opacity-0 stagger-1 inline-block px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-amber-400 border border-amber-400/30 rounded-full mb-8 font-body">
            {t("contact.badge")}
          </span>
          <h1 className="animate-fade-in-up opacity-0 stagger-2 font-display text-4xl sm:text-5xl lg:text-7xl tracking-tight text-cream-100 leading-[1.05]">
            {t("contact.title")}
          </h1>
          <p className="animate-fade-in-up opacity-0 stagger-3 mt-8 text-lg text-cream-300/70 leading-relaxed max-w-2xl mx-auto font-body">
            {t("contact.subtitle")}
          </p>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Email Support */}
            <div className="card-elevated animate-fade-in-up opacity-0 stagger-1">
              <div className="w-14 h-14 rounded-xl bg-forest-50 text-forest-600 flex items-center justify-center mb-6">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h3 className="heading-sm mb-2">{t("contact.emailTitle")}</h3>
              <p className="text-body-sm mb-4">{t("contact.emailDesc")}</p>
              <a
                href="mailto:support@mortly.ca"
                className="inline-flex items-center gap-2 font-body text-sm font-semibold text-forest-700 hover:text-amber-600 transition-colors"
              >
                support@mortly.ca
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
            </div>

            {/* Response Time */}
            <div className="card-elevated animate-fade-in-up opacity-0 stagger-2">
              <div className="w-14 h-14 rounded-xl bg-forest-50 text-forest-600 flex items-center justify-center mb-6">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="heading-sm mb-2">{t("contact.responseTitle")}</h3>
              <p className="text-body-sm">{t("contact.responseDesc")}</p>
            </div>
          </div>

          {/* FAQ prompt */}
          <div className="mt-12 text-center animate-fade-in-up opacity-0 stagger-3">
            <div className="inline-flex items-center gap-3 rounded-xl bg-cream-50 border border-cream-200 px-6 py-4">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
              <p className="font-body text-sm text-forest-700">
                {t("contact.faqHint")}{" "}
                <Link href="/how-it-works#faq" className="font-semibold text-forest-700 underline underline-offset-2 hover:text-amber-600 transition-colors">
                  {t("contact.faqLink")}
                </Link>
              </p>
            </div>
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
