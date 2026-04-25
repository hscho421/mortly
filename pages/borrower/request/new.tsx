import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Head from "next/head";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import BorrowerShell from "@/components/borrower/BorrowerShell";
import RequestFormLayout from "@/components/borrower/RequestFormLayout";
import { AppTopbar, Btn } from "@/components/broker/ui";
import { SkeletonForm } from "@/components/Skeleton";
import RequestForm, {
  type RequestFormSnapshot,
} from "@/components/RequestForm";
import type { CreateRequestInput } from "@/types";
import posthog from "posthog-js";

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});

export default function NewRequestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");
  const [snapshot, setSnapshot] = useState<RequestFormSnapshot | null>(null);

  // Warn on accidental tab close mid-form. Hook order must stay stable, so
  // it sits above any conditional return.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  if (status === "loading") {
    return (
      <BorrowerShell active="dashboard" pageTitle={t("titles.borrowerNewRequest")}>
        <SkeletonForm />
      </BorrowerShell>
    );
  }

  if (!session || session.user.role !== "BORROWER") {
    if (typeof window !== "undefined") {
      router.push("/login", undefined, { locale: router.locale });
    }
    return null;
  }

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

  const step = snapshot?.step ?? 1;
  const totalSteps = snapshot?.totalSteps ?? 3;

  return (
    <BorrowerShell active="dashboard" pageTitle={t("titles.borrowerNewRequest")}>
      <Head>
        <title>{t("titles.borrowerNewRequest")}</title>
      </Head>

      <AppTopbar
        eyebrow={
          <>
            {t("request.stepLabel", "STEP {{n}} / {{total}}", {
              n: step,
              total: totalSteps,
            })}
          </>
        }
        title={t("request.newRequestTitle")}
        actions={
          <Btn
            as="a"
            href="/borrower/dashboard"
            size="sm"
            variant="ghost"
          >
            {t("request.cancel", "Cancel")}
          </Btn>
        }
      />

      <RequestFormLayout
        step={step}
        totalSteps={totalSteps}
        form={snapshot?.form ?? null}
        goToStep={snapshot?.goToStep}
      >
        <RequestForm
          onSubmit={handleSubmit}
          hideStepper
          onStateChange={setSnapshot}
        />
      </RequestFormLayout>
    </BorrowerShell>
  );
}
