import { useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";

export default function VerificationRedirect() {
  const router = useRouter();
  const { t } = useTranslation("common");

  useEffect(() => {
    router.replace("/admin/brokers?status=PENDING", undefined, {
      locale: router.locale,
    });
  }, [router]);

  return <Head><title>{t("admin.sidebar.verification")}</title></Head>;
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});
