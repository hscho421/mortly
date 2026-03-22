import Link from "next/link";
import Head from "next/head";
import Layout from "@/components/Layout";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";

export default function ServerError() {
  const { t } = useTranslation("common");

  return (
    <Layout>
      <Head>
        <title>{`${t("serverError.title")} — mortly`}</title>
      </Head>

      <div className="flex min-h-[calc(100vh-160px)] items-center justify-center px-4">
        <div className="text-center animate-fade-in-up">
          <p className="font-display text-6xl text-forest-800 sm:text-8xl lg:text-9xl">500</p>
          <h1 className="mt-4 heading-lg">{t("serverError.heading")}</h1>
          <p className="mt-3 text-body max-w-md mx-auto">
            {t("serverError.description")}
          </p>
          <div className="mt-8">
            <Link href="/" className="btn-primary px-6 py-3">
              {t("notFound.goHome")}
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export const getStaticProps = async ({ locale }: { locale: string }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});
