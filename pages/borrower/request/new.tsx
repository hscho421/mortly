import { useState, FormEvent } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import Layout from "@/components/Layout";
import type { CreateRequestInput } from "@/types";

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

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});

export default function NewRequest() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const { data: session, status } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<CreateRequestInput>({
    mortgageCategory: "RESIDENTIAL",
    requestType: "PURCHASE",
    province: "",
    city: "",
    propertyType: "DETACHED",
    priceRangeMin: undefined,
    priceRangeMax: undefined,
    downPaymentPercent: "",
    incomeRangeMin: undefined,
    incomeRangeMax: undefined,
    employmentType: "FULL_TIME",
    creditScoreBand: "GOOD",
    debtRangeMin: undefined,
    debtRangeMax: undefined,
    mortgageAmountMin: undefined,
    mortgageAmountMax: undefined,
    preferredTerm: "5 years",
    preferredType: "FIXED",
    closingTimeline: "",
    notes: "",
  });

  if (status === "loading") {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (status === "unauthenticated" || !session) {
    if (typeof window !== "undefined") {
      router.replace("/login?callbackUrl=/borrower/request/new", undefined, { locale: router.locale });
    }
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">Redirecting to login...</p>
        </div>
      </Layout>
    );
  }

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to submit request");
      }

      const data = await res.json();
      router.push(`/borrower/request/${data.id}`, undefined, { locale: router.locale });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
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
        {/* Privacy notice */}
        <div className="mb-8 rounded-2xl bg-forest-50 border border-forest-200 p-5 animate-fade-in-up stagger-1">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-forest-600 mt-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <p className="text-body-sm">
              <strong className="text-forest-800">{t("request.privacyNote")}</strong>
            </p>
          </div>
        </div>

        <h1 className="heading-lg mb-2 animate-fade-in-up stagger-2">
          {t("request.title")}
        </h1>
        <p className="text-body mb-8 animate-fade-in-up stagger-3">
          {t("request.subtitle")}
        </p>

        {error && (
          <div className="mb-6 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 font-body">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Section 0: Mortgage Category */}
          <fieldset className="space-y-6 animate-fade-in-up stagger-4">
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
          <fieldset className="space-y-6 animate-fade-in-up stagger-4">
            <legend className="heading-sm border-b divider pb-3 w-full">
              What type of mortgage help do you need?
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
          <fieldset className="space-y-6 animate-fade-in-up stagger-5">
            <legend className="heading-sm border-b divider pb-3 w-full">
              Property Details
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
                    <option key={p} value={p}>
                      {p}
                    </option>
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
                  onChange={(e) =>
                    handleNumberChange("priceRangeMin", e.target.value)
                  }
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
                  onChange={(e) =>
                    handleNumberChange("priceRangeMax", e.target.value)
                  }
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
                onChange={(e) =>
                  updateField("downPaymentPercent", e.target.value)
                }
                className="input-field"
              >
                <option value="">Select an option</option>
                {DOWN_PAYMENT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>

          {/* Section 3: Financial profile */}
          <fieldset className="space-y-6 animate-fade-in-up stagger-6">
            <legend className="heading-sm border-b divider pb-3 w-full">
              Financial Profile
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
                  onChange={(e) =>
                    handleNumberChange("incomeRangeMin", e.target.value)
                  }
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
                  onChange={(e) =>
                    handleNumberChange("incomeRangeMax", e.target.value)
                  }
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
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="label-text">{t("request.creditScore")}</span>
              <div className="flex flex-wrap gap-3 mt-2">
                {(
                  ["EXCELLENT", "GOOD", "FAIR", "POOR", "NOT_SURE"] as const
                ).map((band) => (
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
                  onChange={(e) =>
                    handleNumberChange("debtRangeMin", e.target.value)
                  }
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
                  onChange={(e) =>
                    handleNumberChange("debtRangeMax", e.target.value)
                  }
                  placeholder="e.g. 20000"
                  className="input-field"
                />
              </div>
            </div>
          </fieldset>

          {/* Section 4: Mortgage preferences */}
          <fieldset className="space-y-6">
            <legend className="heading-sm border-b divider pb-3 w-full">
              Mortgage Preferences
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
                  onChange={(e) =>
                    handleNumberChange("mortgageAmountMin", e.target.value)
                  }
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
                  onChange={(e) =>
                    handleNumberChange("mortgageAmountMax", e.target.value)
                  }
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
                    <option key={term} value={term}>
                      {term}
                    </option>
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
                onChange={(e) =>
                  updateField("closingTimeline", e.target.value)
                }
                className="input-field"
              >
                <option value="">Select a timeline</option>
                {CLOSING_TIMELINES.map((tl) => (
                  <option key={tl} value={tl}>
                    {tl}
                  </option>
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
                Anything else brokers should know?{" "}
                <span className="text-sage-400">(optional)</span>
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

          {/* Submit */}
          <div className="pt-6 border-t divider">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full sm:w-auto px-10 py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t("request.submitting") : t("request.submit")}
            </button>
            <p className="mt-3 text-body-sm text-sage-400">
              By submitting, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </form>
      </div>
    </Layout>
  );
}
