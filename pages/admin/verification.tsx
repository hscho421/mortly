import { useEffect } from "react";
import { useRouter } from "next/router";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";

export default function VerificationRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/brokers?status=PENDING", undefined, {
      locale: router.locale,
    });
  }, [router]);

  return null;
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});
