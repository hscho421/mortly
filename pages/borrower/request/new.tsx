import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Head from "next/head";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import Layout from "@/components/Layout";
import { SkeletonForm } from "@/components/Skeleton";
import RequestForm from "@/components/RequestForm";
import type { CreateRequestInput } from "@/types";
import posthog from "posthog-js";
import { useEffect } from "react";

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});

export default function NewRequestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");

  if (status === "loading") {
    return (
      <Layout>
        <SkeletonForm />
      </Layout>
    );
  }

  if (!session || session.user.role !== "BORROWER") {
    if (typeof window !== "undefined") {
      router.push("/login", undefined, { locale: router.locale });
    }
    return null;
  }

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const handleSubmit = async (data: CreateRequestInput) => {
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || t("errors.failedToSubmitRequest"));
    }

    const created = await res.json();
    posthog.capture("loan_request_submitted", {
      mortgage_category: data.mortgageCategory,
      province: data.province,
    });
    router.push(`/borrower/request/${created.publicId}`);
  };

  return (
    <Layout>
      <Head><title>{t("titles.borrowerNewRequest")}</title></Head>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="heading-lg">{t("request.newRequestTitle")}</h1>
        </div>

        <RequestForm onSubmit={handleSubmit} />
      </div>
    </Layout>
  );
}
