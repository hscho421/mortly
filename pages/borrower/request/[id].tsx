import { useState, useEffect, useCallback } from "react";
import { GetServerSideProps } from "next";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import nextI18NextConfig from "@/next-i18next.config.js";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import ConsultationStepper from "@/components/ConsultationStepper";
import RequestForm from "@/components/RequestForm";
import type { CreateRequestInput, ResidentialDetails, CommercialDetails } from "@/types";
import { PRODUCT_LABEL_KEYS, INCOME_TYPE_LABEL_KEYS, TIMELINE_LABEL_KEYS } from "@/lib/requestConfig";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex justify-between py-3 border-b border-cream-200 last:border-0">
      <span className="text-body-sm">{label}</span>
      <span className="text-sm font-medium font-body text-forest-800">{value}</span>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RequestData = any;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  return {
    props: {
      ...(await serverSideTranslations(ctx.locale ?? "ko", ["common"], nextI18NextConfig)),
    },
  };
};

export default function RequestDetail() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const { id } = router.query;

  const [request, setRequest] = useState<RequestData>(null);
  const [loading, setLoading] = useState(true);
  const [introCount, setIntroCount] = useState(0);

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchRequest = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/requests/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.replace("/borrower/dashboard", undefined, { locale: router.locale });
          return;
        }
        throw new Error(t("request.failedToLoad"));
      }
      const data = await res.json();
      setRequest(data);
      setIntroCount(data._count?.introductions ?? data.introductions?.length ?? 0);
    } catch {
      setError(t("request.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session) {
      router.replace("/login", undefined, { locale: router.locale });
      return;
    }
    fetchRequest();
  }, [authStatus, session, fetchRequest, router]);

  async function handleEdit(data: CreateRequestInput) {
    const res = await fetch(`/api/requests/${request.publicId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || t("errors.failedToUpdateRequest"));
    }

    const updated = await res.json();
    setRequest((prev: RequestData) => ({ ...prev, ...updated }));
    setIsEditing(false);
    setSuccessMsg(t("request.editSuccess"));
    setTimeout(() => setSuccessMsg(""), 4000);
  }

  async function handleDelete() {
    setDeleting(true);
    setError("");

    try {
      const res = await fetch(`/api/requests/${request.publicId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("errors.failedToDeleteRequest"));
      }

      router.push("/borrower/dashboard", undefined, { locale: router.locale });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.somethingWentWrong"));
      setShowDeleteModal(false);
      setDeleting(false);
    }
  }

  if (loading || !request) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-600" />
        </div>
      </Layout>
    );
  }

  const isEditable = request.status === "OPEN" || request.status === "PENDING_APPROVAL";

  // Build initial values for editing
  const editInitialValues: CreateRequestInput = {
    mortgageCategory: request.mortgageCategory || "RESIDENTIAL",
    productTypes: request.productTypes || [],
    province: request.province,
    city: request.city || "",
    details: request.details || {},
    desiredTimeline: request.desiredTimeline || "",
    notes: request.notes || "",
  };

  const pageTitle = request.mortgageCategory === "COMMERCIAL"
    ? t("request.commercialRequest")
    : t("request.residentialRequest");

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
        <Link
          href="/borrower/dashboard"
          className="mb-8 inline-flex items-center gap-1 font-body text-sm font-medium text-forest-600 hover:text-forest-800 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          {t("request.backToRequests")}
        </Link>

        {/* Success message */}
        {successMsg && (
          <div className="mb-6 rounded-2xl bg-forest-50 border border-forest-200 p-4 text-sm text-forest-700 font-body animate-fade-in">
            {successMsg}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 font-body animate-fade-in">
            {error}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in-up stagger-1">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="heading-lg">{pageTitle}</h1>
              <StatusBadge status={request.status} />
            </div>
            <p className="text-body-sm">
              {t("misc.created", { date: formatDate(request.createdAt) })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isEditable && !isEditing && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn-secondary text-sm py-2 px-4"
                >
                  {t("request.edit")}
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-body font-medium text-red-600 hover:bg-red-50 hover:border-red-400 transition-all duration-200"
                >
                  {t("request.delete")}
                </button>
              </>
            )}
            <Link
              href="/borrower/request/new"
              className="btn-secondary text-sm py-2 px-4"
            >
              + {t("borrowerDashboard.newRequest")}
            </Link>
          </div>
        </div>

        {/* Rejection banner */}
        {request.status === "REJECTED" && (
          <div className="mb-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 animate-fade-in-up stagger-2">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-rose-100">
                <svg className="h-4 w-4 text-rose-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <h3 className="font-body text-sm font-semibold text-rose-700">{t("request.rejectedTitle", "Request Not Approved")}</h3>
                <p className="mt-1 font-body text-sm text-rose-600">
                  {request.rejectionReason || t("request.rejectedNote", "This request was not approved.")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pending approval banner */}
        {request.status === "PENDING_APPROVAL" && (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 animate-fade-in-up stagger-2">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div>
                <h3 className="font-body text-sm font-semibold text-amber-700">{t("status.pendingApproval", "Pending Approval")}</h3>
                <p className="mt-1 font-body text-sm text-amber-600">
                  {t("request.pendingApprovalNote", "Your request is under review. You'll be notified once approved.")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Consultation Progress Stepper */}
        {request.status !== "REJECTED" && (
          <ConsultationStepper
            requestStatus={request.status}
            hasIntroduction={introCount > 0}
            hasActiveConversation={request.conversations?.some((c: { status: string }) => c.status === "ACTIVE") ?? false}
            conversationClosed={request.conversations?.some((c: { status: string }) => c.status === "CLOSED") ?? false}
          />
        )}

        {/* Broker responses card */}
        <div className="card-elevated mb-8 animate-fade-in-up stagger-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-body-sm">{t("request.brokerResponses")}</p>
              <p className="font-display text-4xl text-forest-800 mt-1">
                {introCount}
              </p>
            </div>
            {introCount > 0 ? (
              <Link
                href={`/borrower/brokers/${request.publicId}`}
                className="btn-amber"
              >
                {t("request.viewBrokerIntros")}
              </Link>
            ) : (
              <span className="text-body-sm text-sage-400">
                {t("request.waitingForBrokers")}
              </span>
            )}
          </div>
        </div>

        {/* Request details - edit mode or read-only */}
        {isEditing ? (
          <div className="animate-fade-in-up stagger-3">
            <RequestForm
              initialValues={editInitialValues}
              onSubmit={handleEdit}
              submitLabel={t("request.saveChanges")}
              submittingLabel={t("request.saving")}
            />
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="btn-secondary mt-4 px-8 py-3"
            >
              {t("request.cancel")}
            </button>
          </div>
        ) : (
          /* Read-only details */
          <div className="card-elevated animate-fade-in-up stagger-3">
            <div className="pb-4 mb-2 border-b divider">
              <h2 className="heading-md">{t("request.requestDetails")}</h2>
            </div>
            <V2ReadOnlyView request={request} />
          </div>
        )}

        {/* Delete confirmation modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 animate-fade-in-up">
              <h3 className="heading-md mb-2">{t("request.delete")}</h3>
              <p className="text-body-sm mb-6">{t("request.deleteConfirm")}</p>
              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="btn-secondary px-6 py-2.5"
                >
                  {t("request.cancel")}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-body font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? t("request.deleting") : t("request.delete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

// ── v2 Read-Only View ─────────────────────────────────────────

function V2ReadOnlyView({ request }: { request: RequestData }) {
  const { t } = useTranslation("common");
  const isResidential = request.mortgageCategory === "RESIDENTIAL";
  const details = request.details || {};

  return (
    <div>
      <DetailRow
        label={t("request.mortgageCategory")}
        value={isResidential ? t("request.residential") : t("request.commercial")}
      />

      {/* Product types */}
      <div className="flex justify-between py-3 border-b border-cream-200">
        <span className="text-body-sm">{t("request.selectProducts", "Services")}</span>
        <div className="flex flex-wrap gap-1.5 justify-end max-w-[60%]">
          {(request.productTypes || []).map((p: string) => (
            <span
              key={p}
              className="inline-flex items-center rounded-full bg-forest-50 px-2.5 py-0.5 font-body text-xs font-medium text-forest-700"
            >
              {t(PRODUCT_LABEL_KEYS[p] || p)}
            </span>
          ))}
        </div>
      </div>

      {/* Location */}
      <h3 className="text-xs font-semibold font-body text-sage-500 mt-6 mb-2 uppercase tracking-widest">
        {t("request.province")}
      </h3>
      <DetailRow label={t("request.province")} value={request.province || "--"} />
      <DetailRow label={t("request.city")} value={request.city || "--"} />

      {/* Category-specific details */}
      {isResidential ? (
        <>
          <h3 className="text-xs font-semibold font-body text-sage-500 mt-6 mb-2 uppercase tracking-widest">
            {t("request.applicantInfo")}
          </h3>
          <DetailRow
            label={t("request.purposeOfUse")}
            value={
              (([] as string[]).concat((details as ResidentialDetails).purposeOfUse)).map((v) => v === "OWNER_OCCUPIED" ? t("request.ownerOccupied") : t("request.rental")).join(", ")
            }
          />
          <div className="flex justify-between py-3 border-b border-cream-200">
            <span className="text-body-sm">{t("request.incomeType")}</span>
            <div className="flex flex-wrap gap-1.5 justify-end max-w-[60%]">
              {((details as ResidentialDetails).incomeTypes || []).map((inc: string) => (
                <span
                  key={inc}
                  className="inline-flex items-center rounded-full bg-cream-200 px-2.5 py-0.5 font-body text-xs font-medium text-forest-700"
                >
                  {t(INCOME_TYPE_LABEL_KEYS[inc] || inc)}
                </span>
              ))}
            </div>
          </div>
          {(details as ResidentialDetails).incomeTypeOther && (
            <DetailRow label={t("request.incomeTypes.other")} value={(details as ResidentialDetails).incomeTypeOther || "--"} />
          )}
          <div className="flex justify-between py-3 border-b border-cream-200">
            <span className="text-body-sm">{t("request.annualIncome")}</span>
            <div className="text-right">
              {Object.entries((details as ResidentialDetails).annualIncome || {}).map(([year, amount]) => (
                <p key={year} className="font-body text-sm text-forest-800">
                  {year}: ${amount || "—"}
                </p>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <h3 className="text-xs font-semibold font-body text-sage-500 mt-6 mb-2 uppercase tracking-widest">
            {t("request.businessInfo")}
          </h3>
          <DetailRow label={t("request.businessType")} value={(details as CommercialDetails).businessType || "--"} />
          <DetailRow label={t("request.corporateIncome")} value={(details as CommercialDetails).corporateAnnualIncome || "--"} />
          <DetailRow label={t("request.corporateExpenses")} value={(details as CommercialDetails).corporateAnnualExpenses || "--"} />
          <DetailRow label={t("request.ownerNetIncome")} value={(details as CommercialDetails).ownerNetIncome || "--"} />
        </>
      )}

      {/* Timeline */}
      <h3 className="text-xs font-semibold font-body text-sage-500 mt-6 mb-2 uppercase tracking-widest">
        {t("request.desiredTimeline")}
      </h3>
      <DetailRow label={t("request.desiredTimeline")} value={request.desiredTimeline ? t(TIMELINE_LABEL_KEYS[request.desiredTimeline] || request.desiredTimeline) : "--"} />

      {/* Notes */}
      {request.notes && (
        <>
          <h3 className="text-xs font-semibold font-body text-sage-500 mt-6 mb-2 uppercase tracking-widest">
            {t("request.additionalDetailsLabel")}
          </h3>
          <p className="text-body py-3">{request.notes}</p>
        </>
      )}
    </div>
  );
}

