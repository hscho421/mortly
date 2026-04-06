import Link from "next/link";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";

export default function Terms() {
  const { t } = useTranslation("common");

  const sections = [
    {
      title: t("terms.s1Title"),
      paragraphs: [t("terms.s1p1"), t("terms.s1p2")],
    },
    {
      title: t("terms.s2Title"),
      paragraphs: [t("terms.s2p1"), t("terms.s2p2")],
    },
    {
      title: t("terms.s3Title"),
      paragraphs: [t("terms.s3p1")],
      list: [t("terms.s3l1"), t("terms.s3l2"), t("terms.s3l3"), t("terms.s3l4")],
      after: [t("terms.s3p2")],
    },
    {
      title: t("terms.s4Title"),
      paragraphs: [t("terms.s4p1"), t("terms.s4p2"), t("terms.s4p3")],
    },
    {
      title: t("terms.s5Title"),
      paragraphs: [t("terms.s5p1")],
      list: [t("terms.s5l1"), t("terms.s5l2"), t("terms.s5l3"), t("terms.s5l4"), t("terms.s5l5")],
      after: [t("terms.s5p2")],
    },
    {
      title: t("terms.s6Title"),
      paragraphs: [t("terms.s6p1")],
      list: [t("terms.s6l1"), t("terms.s6l2"), t("terms.s6l3"), t("terms.s6l4"), t("terms.s6l5"), t("terms.s6l6")],
      after: [t("terms.s6p2")],
    },
    {
      title: t("terms.s7Title"),
      paragraphs: [t("terms.s7p1"), t("terms.s7p2"), t("terms.s7p3"), t("terms.s7p4"), t("terms.s7p5")],
    },
    {
      title: t("terms.s8Title"),
      paragraphs: [t("terms.s8p1")],
      list: [
        t("terms.s8l1"), t("terms.s8l2"), t("terms.s8l3"), t("terms.s8l4"), t("terms.s8l5"),
        t("terms.s8l6"), t("terms.s8l7"), t("terms.s8l8"), t("terms.s8l9"), t("terms.s8l10"),
      ],
    },
    {
      title: t("terms.s9Title"),
      paragraphs: [t("terms.s9p1"), t("terms.s9p2"), t("terms.s9p3")],
    },
    {
      title: t("terms.s10Title"),
      paragraphs: [t("terms.s10p1"), t("terms.s10p2")],
    },
    {
      title: t("terms.s11Title"),
      paragraphs: [t("terms.s11p1"), t("terms.s11p2"), t("terms.s11p3")],
    },
    {
      title: t("terms.s12Title"),
      paragraphs: [t("terms.s12p1"), t("terms.s12p2"), t("terms.s12p3")],
    },
    {
      title: t("terms.s13Title"),
      paragraphs: [t("terms.s13p1"), t("terms.s13p2")],
    },
    {
      title: t("terms.s14Title"),
      paragraphs: [t("terms.s14p1")],
    },
    {
      title: t("terms.s15Title"),
      paragraphs: [t("terms.s15p1"), t("terms.s15p2"), t("terms.s15p3")],
    },
    {
      title: t("terms.s16Title"),
      paragraphs: [t("terms.s16p1"), t("terms.s16p2"), t("terms.s16p3")],
    },
    {
      title: t("terms.s17Title"),
      paragraphs: [t("terms.s17p1"), t("terms.s17p2"), t("terms.s17p3"), t("terms.s17p4")],
    },
  ];

  return (
    <Layout>
      <SEO title={t("terms.headTitle")} description={t("terms.metaDesc")} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-forest-800 via-forest-900 to-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_40%_40%,_theme(colors.sage.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-4xl mx-auto text-center">
          <div className="animate-fade-in-up opacity-0 stagger-1 mx-auto w-16 h-16 rounded-full bg-forest-700/50 border border-sage-400/20 text-amber-400 flex items-center justify-center mb-8">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          <h1 className="animate-fade-in-up opacity-0 stagger-2 font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight text-cream-100 leading-[1.1]">
            {t("terms.heroTitle")}
          </h1>
          <p className="animate-fade-in-up opacity-0 stagger-3 mt-6 text-lg text-cream-300/70 leading-relaxed max-w-2xl mx-auto font-body">
            {t("terms.heroDesc")}
          </p>
          <p className="animate-fade-in-up opacity-0 stagger-4 mt-4 font-body text-sm text-cream-400/50">
            {t("terms.lastUpdated")}
          </p>
        </div>
      </section>

      {/* Terms Content */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-3xl mx-auto">
          <div className="space-y-10">
            {sections.map((section, idx) => (
              <div key={idx} className="animate-fade-in-up opacity-0">
                <h2 className="heading-sm text-forest-800 mb-4">{section.title}</h2>
                <div className="space-y-3">
                  {section.paragraphs.map((p, pIdx) => (
                    <p key={pIdx} className="font-body text-sm text-forest-700/80 leading-relaxed">
                      {p}
                    </p>
                  ))}
                  {section.list && (
                    <ul className="ml-5 space-y-2">
                      {section.list.map((item, lIdx) => (
                        <li key={lIdx} className="font-body text-sm text-forest-700/80 leading-relaxed list-disc">
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                  {section.after?.map((p, aIdx) => (
                    <p key={aIdx} className="font-body text-sm text-forest-700/80 leading-relaxed">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            ))}

            {/* Section 18: Contact */}
            <div className="animate-fade-in-up opacity-0">
              <h2 className="heading-sm text-forest-800 mb-4">{t("terms.s18Title")}</h2>
              <p className="font-body text-sm text-forest-700/80 leading-relaxed mb-2">
                {t("terms.s18p1")}
              </p>
              <a
                href="mailto:support@mortly.ca"
                className="inline-flex items-center gap-2 font-body text-sm font-semibold text-forest-700 underline underline-offset-2 hover:text-amber-600 transition-colors"
              >
                {t("terms.s18email")}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
            </div>
          </div>

          {/* Related links */}
          <div className="mt-16 pt-8 border-t border-cream-300">
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/privacy"
                className="flex-1 rounded-xl border border-cream-200 bg-white p-5 transition-all hover:border-forest-300 hover:shadow-sm"
              >
                <p className="font-body text-xs font-semibold uppercase tracking-widest text-amber-600 mb-1">
                  {t("footer.legal")}
                </p>
                <p className="font-body text-sm font-semibold text-forest-800">
                  {t("footer.privacyTrust")}
                </p>
              </Link>
              <Link
                href="/contact"
                className="flex-1 rounded-xl border border-cream-200 bg-white p-5 transition-all hover:border-forest-300 hover:shadow-sm"
              >
                <p className="font-body text-xs font-semibold uppercase tracking-widest text-amber-600 mb-1">
                  {t("contact.badge")}
                </p>
                <p className="font-body text-sm font-semibold text-forest-800">
                  {t("footer.contact")}
                </p>
              </Link>
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
