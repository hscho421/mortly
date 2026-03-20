import { useState, FormEvent } from "react";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { getServerSession } from "next-auth";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { RequestWithIntroductions, CreateRequestInput } from "@/types";

const PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Northwest Territories",
  "Nova Scotia",
  "Nunavut",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
  "Yukon",
];

const DOWN_PAYMENT_OPTIONS = ["5%", "10%", "15%", "20%+"];

const PREFERRED_TERMS = [
  "1 year",
  "2 years",
  "3 years",
  "4 years",
  "5 years",
  "7 years",
  "10 years",
];

const CLOSING_TIMELINES = [
  "Within 30 days",
  "1-3 months",
  "3-6 months",
  "6-12 months",
  "Just exploring",
];

function formatCurrency(val: number | null | undefined) {
  if (val == null) return "--";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(val);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function displayLabel(val: string | null | undefined) {
  if (!val) return "--";
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

type Props = {
  request: RequestWithIntroductions;
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const id = ctx.params?.id as string;

  try {
    const request = await prisma.borrowerRequest.findUnique({
      where: { id },
      include: {
        introductions: {
          include: {
            broker: {
              include: {
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
        _count: { select: { introductions: true } },
      },
    });

    if (!request || request.borrowerId !== session.user.id) {
      return { notFound: true };
    }

    return {
      props: {
        request: JSON.parse(JSON.stringify(request)),
        ...(await serverSideTranslations(ctx.locale ?? "en", ["common"])),
      },
    };
  } catch (error) {
    console.error("Error loading request detail:", error instanceof Error ? error.message : error, error instanceof Error ? error.stack : "");
    return { notFound: true };
  }
};

export default function RequestDetail({
  request: initialRequest,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const [request, setRequest] = useState(initialRequest);
  const introCount = request._count.introductions;

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [form, setForm] = useState<CreateRequestInput>({
    mortgageCategory: request.mortgageCategory || "RESIDENTIAL",
    requestType: request.requestType,
    province: request.province,
    city: request.city || "",
    propertyType: request.propertyType,
    priceRangeMin: request.priceRangeMin ?? undefined,
    priceRangeMax: request.priceRangeMax ?? undefined,
    downPaymentPercent: request.downPaymentPercent || "",
    incomeRangeMin: request.incomeRangeMin ?? undefined,
    incomeRangeMax: request.incomeRangeMax ?? undefined,
    employmentType: request.employmentType || "",
    creditScoreBand: request.creditScoreBand || "",
    debtRangeMin: request.debtRangeMin ?? undefined,
    debtRangeMax: request.debtRangeMax ?? undefined,
    mortgageAmountMin: request.mortgageAmountMin ?? undefined,
    mortgageAmountMax: request.mortgageAmountMax ?? undefined,
    preferredTerm: request.preferredTerm || "",
    preferredType: request.preferredType || "",
    closingTimeline: request.closingTimeline || "",
    notes: request.notes || "",
  });

  const isOpen = request.status === "OPEN";

  function updateField<K extends keyof CreateRequestInput>(
    key: K,
    value: CreateRequestInput[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleNumberChange(key: keyof CreateRequestInput, raw: string) {
    const parsed = raw === "" ? undefined : Number(raw);
    updateField(key, parsed as CreateRequestInput[typeof key]);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setError("");
    setForm({
      mortgageCategory: request.mortgageCategory || "RESIDENTIAL",
      requestType: request.requestType,
      province: request.province,
      city: request.city || "",
      propertyType: request.propertyType,
      priceRangeMin: request.priceRangeMin ?? undefined,
      priceRangeMax: request.priceRangeMax ?? undefined,
      downPaymentPercent: request.downPaymentPercent || "",
      incomeRangeMin: request.incomeRangeMin ?? undefined,
      incomeRangeMax: request.incomeRangeMax ?? undefined,
      employmentType: request.employmentType || "",
      creditScoreBand: request.creditScoreBand || "",
      debtRangeMin: request.debtRangeMin ?? undefined,
      debtRangeMax: request.debtRangeMax ?? undefined,
      mortgageAmountMin: request.mortgageAmountMin ?? undefined,
      mortgageAmountMax: request.mortgageAmountMax ?? undefined,
      preferredTerm: request.preferredTerm || "",
      preferredType: request.preferredType || "",
      closingTimeline: request.closingTimeline || "",
      notes: request.notes || "",
    });
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await fetch(`/api/requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update request");
      }

      const updated = await res.json();
      setRequest((prev) => ({ ...prev, ...updated }));
      setIsEditing(false);
      setSuccessMsg(t("request.editSuccess"));
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError("");

    try {
      const res = await fetch(`/api/requests/${request.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete request");
      }

      router.push("/borrower/dashboard", undefined, { locale: router.locale });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setShowDeleteModal(false);
      setDeleting(false);
    }
  }

  const radioOptionClass = (isSelected: boolean) =>
    `flex items-center gap-2 rounded-xl border px-4 py-3 cursor-pointer text-sm font-body transition-all duration-200 ${
      isSelected
        ? "border-forest-600 bg-forest-50 text-forest-800 ring-2 ring-forest-600/10"
        : "border-cream-300 bg-white hover:border-sage-300 text-forest-700"
    }`;

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
              <h1 className="heading-lg">
                {displayLabel(request.requestType)} {t("request.requestLabel")}
              </h1>
              <StatusBadge status={request.status} />
            </div>
            <p className="text-body-sm">
              Created {formatDate(request.createdAt as unknown as string)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isOpen && !isEditing && (
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
                href={`/borrower/brokers/${request.id}`}
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

        {/* Request details - read-only or edit mode */}
        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="card-elevated animate-fade-in-up stagger-3">
            <div className="pb-4 mb-2 border-b divider">
              <h2 className="heading-md">{t("request.edit")}</h2>
            </div>

            <div className="space-y-10 mt-4">
              {/* Section 0: Mortgage Category */}
              <fieldset className="space-y-6">
                <legend className="heading-sm border-b divider pb-3 w-full">
                  {t("request.mortgageCategory")}
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(["RESIDENTIAL", "COMMERCIAL"] as const).map((cat) => (
                    <label
                      key={cat}
                      className={`relative flex flex-col items-center gap-3 rounded-2xl border-2 px-6 py-8 cursor-pointer text-center transition-all duration-200 ${
                        form.mortgageCategory === cat
                          ? "border-forest-600 bg-forest-50 ring-2 ring-forest-600/10"
                          : "border-cream-300 bg-white hover:border-sage-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="mortgageCategory"
                        value={cat}
                        checked={form.mortgageCategory === cat}
                        onChange={() => updateField("mortgageCategory", cat)}
                        className="sr-only"
                      />
                      <svg
                        className={`w-10 h-10 ${form.mortgageCategory === cat ? "text-forest-600" : "text-sage-400"}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        {cat === "RESIDENTIAL" ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                        )}
                      </svg>
                      <span className="text-base font-semibold font-body text-forest-800">
                        {cat === "RESIDENTIAL" ? t("request.residential") : t("request.commercial")}
                      </span>
                      <span className="text-sm font-body text-sage-500">
                        {cat === "RESIDENTIAL" ? t("request.residentialDesc") : t("request.commercialDesc")}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Section 1: Request basics */}
              <fieldset className="space-y-6">
                <legend className="heading-sm border-b divider pb-3 w-full">
                  {t("request.requestType")}
                </legend>
                <div>
                  <span className="label-text">{t("request.requestType")}</span>
                  <div className="flex flex-wrap gap-4 mt-2">
                    {(["PURCHASE", "REFINANCE", "RENEWAL"] as const).map((type) => (
                      <label
                        key={type}
                        className={radioOptionClass(form.requestType === type)}
                      >
                        <input
                          type="radio"
                          name="requestType"
                          value={type}
                          checked={form.requestType === type}
                          onChange={() => updateField("requestType", type)}
                          className="accent-forest-600"
                        />
                        {type.charAt(0) + type.slice(1).toLowerCase()}
                      </label>
                    ))}
                  </div>
                </div>
              </fieldset>

              {/* Section 2: Property details */}
              <fieldset className="space-y-6">
                <legend className="heading-sm border-b divider pb-3 w-full">
                  {t("request.property")}
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="province" className="label-text">
                      {t("request.province")}
                    </label>
                    <select
                      id="province"
                      value={form.province}
                      onChange={(e) => updateField("province", e.target.value)}
                      required
                      className="input-field"
                    >
                      <option value="">{t("request.selectProvince")}</option>
                      {PROVINCES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="city" className="label-text">
                      {t("request.city")}
                    </label>
                    <input
                      id="city"
                      type="text"
                      value={form.city || ""}
                      onChange={(e) => updateField("city", e.target.value)}
                      placeholder="e.g. Toronto"
                      className="input-field"
                    />
                  </div>
                </div>

                <div>
                  <span className="label-text">{t("request.propertyType")}</span>
                  <div className="flex flex-wrap gap-4 mt-2">
                    {(["CONDO", "TOWNHOUSE", "DETACHED", "OTHER"] as const).map(
                      (type) => (
                        <label
                          key={type}
                          className={radioOptionClass(form.propertyType === type)}
                        >
                          <input
                            type="radio"
                            name="propertyType"
                            value={type}
                            checked={form.propertyType === type}
                            onChange={() => updateField("propertyType", type)}
                            className="accent-forest-600"
                          />
                          {type.charAt(0) + type.slice(1).toLowerCase()}
                        </label>
                      )
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="priceRangeMin" className="label-text">
                      {t("request.priceRange")} ({t("request.min")} $)
                    </label>
                    <input
                      id="priceRangeMin"
                      type="number"
                      min={0}
                      value={form.priceRangeMin ?? ""}
                      onChange={(e) => handleNumberChange("priceRangeMin", e.target.value)}
                      placeholder="e.g. 300000"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label htmlFor="priceRangeMax" className="label-text">
                      {t("request.priceRange")} ({t("request.max")} $)
                    </label>
                    <input
                      id="priceRangeMax"
                      type="number"
                      min={0}
                      value={form.priceRangeMax ?? ""}
                      onChange={(e) => handleNumberChange("priceRangeMax", e.target.value)}
                      placeholder="e.g. 600000"
                      className="input-field"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="downPaymentPercent" className="label-text">
                    {t("request.downPayment")}
                  </label>
                  <select
                    id="downPaymentPercent"
                    value={form.downPaymentPercent || ""}
                    onChange={(e) => updateField("downPaymentPercent", e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select an option</option>
                    {DOWN_PAYMENT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </fieldset>

              {/* Section 3: Financial profile */}
              <fieldset className="space-y-6">
                <legend className="heading-sm border-b divider pb-3 w-full">
                  {t("request.financial")}
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="incomeRangeMin" className="label-text">
                      {t("request.income")} ({t("request.min")} $)
                    </label>
                    <input
                      id="incomeRangeMin"
                      type="number"
                      min={0}
                      value={form.incomeRangeMin ?? ""}
                      onChange={(e) => handleNumberChange("incomeRangeMin", e.target.value)}
                      placeholder="e.g. 80000"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label htmlFor="incomeRangeMax" className="label-text">
                      {t("request.income")} ({t("request.max")} $)
                    </label>
                    <input
                      id="incomeRangeMax"
                      type="number"
                      min={0}
                      value={form.incomeRangeMax ?? ""}
                      onChange={(e) => handleNumberChange("incomeRangeMax", e.target.value)}
                      placeholder="e.g. 120000"
                      className="input-field"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="employmentType" className="label-text">
                    {t("request.employmentType")}
                  </label>
                  <select
                    id="employmentType"
                    value={form.employmentType || ""}
                    onChange={(e) => updateField("employmentType", e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select employment type</option>
                    {[
                      ["FULL_TIME", "Full Time"],
                      ["PART_TIME", "Part Time"],
                      ["SELF_EMPLOYED", "Self Employed"],
                      ["CONTRACT", "Contract"],
                      ["RETIRED", "Retired"],
                      ["OTHER", "Other"],
                    ].map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="label-text">{t("request.creditScore")}</span>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {(["EXCELLENT", "GOOD", "FAIR", "POOR", "NOT_SURE"] as const).map((band) => (
                      <label
                        key={band}
                        className={radioOptionClass(form.creditScoreBand === band)}
                      >
                        <input
                          type="radio"
                          name="creditScoreBand"
                          value={band}
                          checked={form.creditScoreBand === band}
                          onChange={() => updateField("creditScoreBand", band)}
                          className="accent-forest-600"
                        />
                        {band === "NOT_SURE"
                          ? "Not Sure"
                          : band.charAt(0) + band.slice(1).toLowerCase()}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="debtRangeMin" className="label-text">
                      {t("request.existingDebts")} ({t("request.min")} $)
                    </label>
                    <input
                      id="debtRangeMin"
                      type="number"
                      min={0}
                      value={form.debtRangeMin ?? ""}
                      onChange={(e) => handleNumberChange("debtRangeMin", e.target.value)}
                      placeholder="e.g. 0"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label htmlFor="debtRangeMax" className="label-text">
                      {t("request.existingDebts")} ({t("request.max")} $)
                    </label>
                    <input
                      id="debtRangeMax"
                      type="number"
                      min={0}
                      value={form.debtRangeMax ?? ""}
                      onChange={(e) => handleNumberChange("debtRangeMax", e.target.value)}
                      placeholder="e.g. 20000"
                      className="input-field"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Section 4: Mortgage preferences */}
              <fieldset className="space-y-6">
                <legend className="heading-sm border-b divider pb-3 w-full">
                  {t("request.mortgagePreferences")}
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="mortgageAmountMin" className="label-text">
                      {t("request.mortgageAmount")} ({t("request.min")} $)
                    </label>
                    <input
                      id="mortgageAmountMin"
                      type="number"
                      min={0}
                      value={form.mortgageAmountMin ?? ""}
                      onChange={(e) => handleNumberChange("mortgageAmountMin", e.target.value)}
                      placeholder="e.g. 250000"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label htmlFor="mortgageAmountMax" className="label-text">
                      {t("request.mortgageAmount")} ({t("request.max")} $)
                    </label>
                    <input
                      id="mortgageAmountMax"
                      type="number"
                      min={0}
                      value={form.mortgageAmountMax ?? ""}
                      onChange={(e) => handleNumberChange("mortgageAmountMax", e.target.value)}
                      placeholder="e.g. 500000"
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="preferredTerm" className="label-text">
                      {t("request.preferredTerm")}
                    </label>
                    <select
                      id="preferredTerm"
                      value={form.preferredTerm || ""}
                      onChange={(e) => updateField("preferredTerm", e.target.value)}
                      className="input-field"
                    >
                      <option value="">Select a term</option>
                      {PREFERRED_TERMS.map((term) => (
                        <option key={term} value={term}>{term}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="label-text">{t("request.preferredType")}</span>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {(["FIXED", "VARIABLE", "NOT_SURE"] as const).map((type) => (
                        <label
                          key={type}
                          className={radioOptionClass(form.preferredType === type)}
                        >
                          <input
                            type="radio"
                            name="preferredType"
                            value={type}
                            checked={form.preferredType === type}
                            onChange={() => updateField("preferredType", type)}
                            className="accent-forest-600"
                          />
                          {type === "NOT_SURE"
                            ? "Not Sure"
                            : type.charAt(0) + type.slice(1).toLowerCase()}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="closingTimeline" className="label-text">
                    {t("request.closingTimeline")}
                  </label>
                  <select
                    id="closingTimeline"
                    value={form.closingTimeline || ""}
                    onChange={(e) => updateField("closingTimeline", e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select a timeline</option>
                    {CLOSING_TIMELINES.map((tl) => (
                      <option key={tl} value={tl}>{tl}</option>
                    ))}
                  </select>
                </div>
              </fieldset>

              {/* Section 5: Additional notes */}
              <fieldset className="space-y-6">
                <legend className="heading-sm border-b divider pb-3 w-full">
                  {t("request.additionalNotes")}
                </legend>
                <div>
                  <label htmlFor="notes" className="label-text">
                    {t("request.additionalNotes")}
                  </label>
                  <textarea
                    id="notes"
                    rows={4}
                    value={form.notes || ""}
                    onChange={(e) => updateField("notes", e.target.value)}
                    placeholder="e.g. First-time buyer, looking for pre-approval, unique income situation..."
                    className="input-field"
                  />
                </div>
              </fieldset>

              {/* Action buttons */}
              <div className="pt-6 border-t divider flex items-center gap-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? t("request.saving") : t("request.saveChanges")}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="btn-secondary px-8 py-3"
                >
                  {t("request.cancel")}
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* Read-only details */
          <div className="card-elevated animate-fade-in-up stagger-3">
            <div className="pb-4 mb-2 border-b divider">
              <h2 className="heading-md">
                {t("request.requestDetails")}
              </h2>
            </div>

            <div>
              <DetailRow label={t("request.mortgageCategory")} value={request.mortgageCategory === "COMMERCIAL" ? t("request.commercial") : t("request.residential")} />

              <h3 className="text-xs font-semibold font-body text-sage-500 mt-6 mb-2 uppercase tracking-widest">
                {t("request.property")}
              </h3>
              <DetailRow label={t("request.requestType")} value={displayLabel(request.requestType)} />
              <DetailRow label={t("request.province")} value={request.province || "--"} />
              <DetailRow label={t("request.city")} value={request.city || "--"} />
              <DetailRow label={t("request.propertyType")} value={displayLabel(request.propertyType)} />
              <DetailRow
                label={t("request.priceRange")}
                value={`${formatCurrency(request.priceRangeMin)} - ${formatCurrency(request.priceRangeMax)}`}
              />
              <DetailRow
                label={t("request.downPayment")}
                value={request.downPaymentPercent || "--"}
              />

              <h3 className="text-xs font-semibold font-body text-sage-500 mt-8 mb-2 uppercase tracking-widest">
                {t("request.financial")}
              </h3>
              <DetailRow
                label={t("request.income")}
                value={`${formatCurrency(request.incomeRangeMin)} - ${formatCurrency(request.incomeRangeMax)}`}
              />
              <DetailRow
                label={t("request.employmentType")}
                value={displayLabel(request.employmentType)}
              />
              <DetailRow
                label={t("request.creditScore")}
                value={displayLabel(request.creditScoreBand)}
              />
              <DetailRow
                label={t("request.existingDebts")}
                value={`${formatCurrency(request.debtRangeMin)} - ${formatCurrency(request.debtRangeMax)}`}
              />

              <h3 className="text-xs font-semibold font-body text-sage-500 mt-8 mb-2 uppercase tracking-widest">
                {t("request.mortgagePreferences")}
              </h3>
              <DetailRow
                label={t("request.mortgageAmount")}
                value={`${formatCurrency(request.mortgageAmountMin)} - ${formatCurrency(request.mortgageAmountMax)}`}
              />
              <DetailRow
                label={t("request.preferredTerm")}
                value={request.preferredTerm || "--"}
              />
              <DetailRow
                label={t("request.preferredType")}
                value={displayLabel(request.preferredType)}
              />
              <DetailRow
                label={t("request.closingTimeline")}
                value={request.closingTimeline || "--"}
              />

              {request.notes && (
                <>
                  <h3 className="text-xs font-semibold font-body text-sage-500 mt-8 mb-2 uppercase tracking-widest">
                    {t("request.additionalNotes")}
                  </h3>
                  <p className="text-body py-3">{request.notes}</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Delete confirmation modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 animate-fade-in-up">
              <h3 className="heading-md mb-2">{t("request.delete")}</h3>
              <p className="text-body-sm mb-6">
                {t("request.deleteConfirm")}
              </p>
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
