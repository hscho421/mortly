import { useState, FormEvent } from "react";
import { useTranslation } from "next-i18next";
import type { CreateRequestInput, ResidentialDetails, CommercialDetails } from "@/types";
import {
  RESIDENTIAL_PRODUCTS,
  COMMERCIAL_PRODUCTS,
  INCOME_TYPES,
  PRODUCT_LABEL_KEYS,
  INCOME_TYPE_LABEL_KEYS,
  getProductsForCategory,
} from "@/lib/requestConfig";

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

interface RequestFormProps {
  initialValues?: CreateRequestInput;
  onSubmit: (data: CreateRequestInput) => Promise<void>;
  submitLabel?: string;
  submittingLabel?: string;
}

const DEFAULT_RESIDENTIAL_DETAILS: ResidentialDetails = {
  purposeOfUse: "OWNER_OCCUPIED",
  incomeTypes: [],
  annualIncome: "",
};

const DEFAULT_COMMERCIAL_DETAILS: CommercialDetails = {
  businessType: "",
  corporateAnnualIncome: "",
  corporateAnnualExpenses: "",
  ownerNetIncome: "",
};

export default function RequestForm({
  initialValues,
  onSubmit,
  submitLabel,
  submittingLabel,
}: RequestFormProps) {
  const { t } = useTranslation("common");

  const [form, setForm] = useState<CreateRequestInput>(
    initialValues || {
      mortgageCategory: "RESIDENTIAL",
      productTypes: [],
      province: "",
      city: "",
      details: { ...DEFAULT_RESIDENTIAL_DETAILS },
      desiredTimeline: "",
      notes: "",
    }
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isResidential = form.mortgageCategory === "RESIDENTIAL";
  const isCommercial = form.mortgageCategory === "COMMERCIAL";
  const products = getProductsForCategory(form.mortgageCategory);
  const details = form.details as ResidentialDetails | CommercialDetails;

  // ── Updaters ────────────────────────────────────────────────

  function setCategory(category: "RESIDENTIAL" | "COMMERCIAL") {
    setForm((prev) => ({
      ...prev,
      mortgageCategory: category,
      productTypes: [],
      details:
        category === "RESIDENTIAL"
          ? { ...DEFAULT_RESIDENTIAL_DETAILS }
          : { ...DEFAULT_COMMERCIAL_DETAILS },
    }));
  }

  function toggleProduct(value: string) {
    setForm((prev) => ({
      ...prev,
      productTypes: prev.productTypes.includes(value)
        ? prev.productTypes.filter((p) => p !== value)
        : [...prev.productTypes, value],
    }));
  }

  function updateDetails<K extends string>(key: K, value: unknown) {
    setForm((prev) => ({
      ...prev,
      details: { ...prev.details, [key]: value },
    }));
  }

  function toggleIncomeType(value: string) {
    const d = details as ResidentialDetails;
    const current = d.incomeTypes || [];
    const updated = current.includes(value)
      ? current.filter((t) => t !== value)
      : [...current, value];
    updateDetails("incomeTypes", updated);
  }

  // ── Submit ──────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Styling helpers ─────────────────────────────────────────

  const categoryCardClass = (active: boolean) =>
    `relative flex-1 cursor-pointer rounded-2xl border-2 p-5 sm:p-6 transition-all duration-200 ${
      active
        ? "border-forest-600 bg-forest-50 shadow-md"
        : "border-cream-200 bg-white hover:border-forest-300 hover:bg-cream-50"
    }`;

  const checkboxClass = (checked: boolean) =>
    `flex items-center gap-3 cursor-pointer rounded-xl border px-4 py-3 transition-all duration-200 ${
      checked
        ? "border-forest-600 bg-forest-50"
        : "border-cream-200 bg-white hover:border-forest-300"
    }`;

  const radioClass = (active: boolean) =>
    `flex-1 cursor-pointer rounded-xl border-2 px-5 py-3 text-center transition-all duration-200 font-body text-sm font-medium ${
      active
        ? "border-forest-600 bg-forest-50 text-forest-800"
        : "border-cream-200 bg-white text-sage-500 hover:border-forest-300"
    }`;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 animate-fade-in">
          <p className="font-body text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ── Section 1: Category ─────────────────────────────── */}
      <div className="card-elevated animate-fade-in-up stagger-1">
        <h2 className="heading-sm mb-2">{t("request.categoryQuestion")}</h2>
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div
            className={categoryCardClass(isResidential)}
            onClick={() => setCategory("RESIDENTIAL")}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isResidential ? "bg-forest-600 text-white" : "bg-cream-200 text-sage-500"}`}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
              </div>
              <div>
                <p className="font-body text-sm font-semibold text-forest-800">{t("request.residential")}</p>
                <p className="font-body text-xs text-sage-500 mt-0.5">{t("request.residentialDesc")}</p>
              </div>
            </div>
          </div>

          <div
            className={categoryCardClass(isCommercial)}
            onClick={() => setCategory("COMMERCIAL")}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isCommercial ? "bg-forest-600 text-white" : "bg-cream-200 text-sage-500"}`}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                </svg>
              </div>
              <div>
                <p className="font-body text-sm font-semibold text-forest-800">{t("request.commercial")}</p>
                <p className="font-body text-xs text-sage-500 mt-0.5">{t("request.commercialDesc")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Product Types ────────────────────────── */}
      <div className="card-elevated animate-fade-in-up stagger-2">
        <h2 className="heading-sm mb-1">
          {isResidential ? t("request.residential") : t("request.commercial")}
        </h2>
        <p className="text-body-sm mb-4">{t("request.selectProducts")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {products.map((value) => {
            const checked = form.productTypes.includes(value);
            return (
              <label key={value} className={checkboxClass(checked)}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleProduct(value)}
                  className="h-4 w-4 rounded border-cream-300 text-forest-600 focus:ring-forest-500"
                />
                <span className="font-body text-sm text-forest-800">
                  {t(PRODUCT_LABEL_KEYS[value])}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* ── Section 3: Location ─────────────────────────────── */}
      <div className="card-elevated animate-fade-in-up stagger-3">
        <h2 className="heading-sm mb-4">{t("request.province")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="province" className="label-text">
              {t("request.province")}
            </label>
            <select
              id="province"
              required
              value={form.province}
              onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))}
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
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* ── Section 4: Category-Specific Fields ─────────────── */}
      {isResidential ? (
        <div className="card-elevated animate-fade-in-up stagger-4">
          <h2 className="heading-sm mb-4">{t("request.applicantInfo")}</h2>

          {/* Purpose of use */}
          <div className="mb-6">
            <label className="label-text">{t("request.purposeOfUse")}</label>
            <div className="flex gap-3 mt-1">
              <label className={radioClass((details as ResidentialDetails).purposeOfUse === "OWNER_OCCUPIED")}>
                <input
                  type="radio"
                  name="purposeOfUse"
                  value="OWNER_OCCUPIED"
                  checked={(details as ResidentialDetails).purposeOfUse === "OWNER_OCCUPIED"}
                  onChange={() => updateDetails("purposeOfUse", "OWNER_OCCUPIED")}
                  className="sr-only"
                />
                {t("request.ownerOccupied")}
              </label>
              <label className={radioClass((details as ResidentialDetails).purposeOfUse === "RENTAL")}>
                <input
                  type="radio"
                  name="purposeOfUse"
                  value="RENTAL"
                  checked={(details as ResidentialDetails).purposeOfUse === "RENTAL"}
                  onChange={() => updateDetails("purposeOfUse", "RENTAL")}
                  className="sr-only"
                />
                {t("request.rental")}
              </label>
            </div>
          </div>

          {/* Income types */}
          <div className="mb-6">
            <label className="label-text">{t("request.incomeType")}</label>
            <p className="font-body text-xs text-sage-400 mb-2">{t("request.incomeTypeHelper")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INCOME_TYPES.map((value) => {
                const checked = ((details as ResidentialDetails).incomeTypes || []).includes(value);
                return (
                  <label key={value} className={checkboxClass(checked)}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleIncomeType(value)}
                      className="h-4 w-4 rounded border-cream-300 text-forest-600 focus:ring-forest-500"
                    />
                    <span className="font-body text-sm text-forest-800">
                      {t(INCOME_TYPE_LABEL_KEYS[value])}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Other income text input */}
            {((details as ResidentialDetails).incomeTypes || []).includes("OTHER") && (
              <div className="mt-3 animate-fade-in">
                <input
                  type="text"
                  value={(details as ResidentialDetails).incomeTypeOther || ""}
                  onChange={(e) => updateDetails("incomeTypeOther", e.target.value)}
                  placeholder={t("request.incomeTypeOtherPlaceholder")}
                  className="input-field"
                />
              </div>
            )}
          </div>

          {/* Annual income */}
          <div>
            <label htmlFor="annualIncome" className="label-text">
              {t("request.annualIncome")}
            </label>
            <input
              id="annualIncome"
              type="text"
              value={(details as ResidentialDetails).annualIncome || ""}
              onChange={(e) => updateDetails("annualIncome", e.target.value)}
              placeholder={t("request.annualIncomePlaceholder")}
              className="input-field"
            />
          </div>
        </div>
      ) : (
        <div className="card-elevated animate-fade-in-up stagger-4">
          <h2 className="heading-sm mb-4">{t("request.businessInfo")}</h2>

          {/* Business type */}
          <div className="mb-5">
            <label htmlFor="businessType" className="label-text">
              {t("request.businessType")}
            </label>
            <input
              id="businessType"
              type="text"
              required
              value={(details as CommercialDetails).businessType || ""}
              onChange={(e) => updateDetails("businessType", e.target.value)}
              placeholder={t("request.businessTypePlaceholder")}
              className="input-field"
            />
          </div>

          {/* Corporate income */}
          <div className="mb-5">
            <label htmlFor="corporateIncome" className="label-text">
              {t("request.corporateIncome")}
            </label>
            <input
              id="corporateIncome"
              type="text"
              value={(details as CommercialDetails).corporateAnnualIncome || ""}
              onChange={(e) => updateDetails("corporateAnnualIncome", e.target.value)}
              placeholder={t("request.corporateIncomePlaceholder")}
              className="input-field"
            />
          </div>

          {/* Corporate expenses */}
          <div className="mb-5">
            <label htmlFor="corporateExpenses" className="label-text">
              {t("request.corporateExpenses")}
            </label>
            <input
              id="corporateExpenses"
              type="text"
              value={(details as CommercialDetails).corporateAnnualExpenses || ""}
              onChange={(e) => updateDetails("corporateAnnualExpenses", e.target.value)}
              placeholder={t("request.corporateExpensesPlaceholder")}
              className="input-field"
            />
          </div>

          {/* Owner net income */}
          <div>
            <label htmlFor="ownerNetIncome" className="label-text">
              {t("request.ownerNetIncome")}
            </label>
            <input
              id="ownerNetIncome"
              type="text"
              value={(details as CommercialDetails).ownerNetIncome || ""}
              onChange={(e) => updateDetails("ownerNetIncome", e.target.value)}
              placeholder={t("request.ownerNetIncomePlaceholder")}
              className="input-field"
            />
          </div>
        </div>
      )}

      {/* ── Section 5: Timeline + Notes ─────────────────────── */}
      <div className="card-elevated animate-fade-in-up stagger-5">
        {/* Desired timeline */}
        <div className="mb-5">
          <label htmlFor="desiredTimeline" className="label-text">
            {t("request.desiredTimeline")}
          </label>
          <select
            id="desiredTimeline"
            value={form.desiredTimeline || ""}
            onChange={(e) => setForm((p) => ({ ...p, desiredTimeline: e.target.value }))}
            className="input-field"
          >
            <option value="">{t("request.timelineSelect")}</option>
            <option value="ASAP">{t("request.timelineAsap")}</option>
            <option value="1_MONTH">{t("request.timeline1Month")}</option>
            <option value="3_MONTHS">{t("request.timeline3Months")}</option>
            <option value="6_MONTHS">{t("request.timeline6Months")}</option>
            <option value="1_YEAR_PLUS">{t("request.timeline1YearPlus")}</option>
          </select>
        </div>

        {/* Additional notes */}
        <div>
          <label htmlFor="notes" className="label-text">
            {t("request.additionalDetailsLabel")}
            {isCommercial && (
              <span className="ml-2 text-xs text-amber-600 font-normal">
                ({t("request.additionalDetailsRequired")})
              </span>
            )}
          </label>
          <p className="font-body text-xs text-sage-400 mb-2">
            {t("request.additionalDetailsHelper")}
          </p>
          <textarea
            id="notes"
            rows={4}
            required={isCommercial}
            value={form.notes || ""}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            className="input-field"
          />
        </div>
      </div>

      {/* ── Submit ──────────────────────────────────────────── */}
      <div className="animate-fade-in-up stagger-6">
        <button
          type="submit"
          disabled={submitting || form.productTypes.length === 0 || !form.province}
          className="btn-primary w-full py-3.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? (submittingLabel || t("request.submitting"))
            : (submitLabel || t("request.submit"))}
        </button>
      </div>
    </form>
  );
}
