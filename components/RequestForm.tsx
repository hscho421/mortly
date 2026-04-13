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

function getYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  return [String(currentYear), String(currentYear - 1), String(currentYear - 2)];
}

const DEFAULT_RESIDENTIAL_DETAILS: ResidentialDetails = {
  purposeOfUse: [],
  incomeTypes: [],
  annualIncome: {},
};

const DEFAULT_COMMERCIAL_DETAILS: CommercialDetails = {
  businessType: "",
  corporateAnnualIncome: {},
  corporateAnnualExpenses: {},
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
  const [step, setStep] = useState(1);
  const totalSteps = 3;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Income year selectors — derive initial from existing data or default to last 2 years
  const currentYear = new Date().getFullYear();
  const existingYears = Object.keys(
    (initialValues?.details as ResidentialDetails)?.annualIncome || {}
  );
  const [incomeYear1, setIncomeYear1] = useState(existingYears[0] || "");
  const [incomeYear2, setIncomeYear2] = useState(existingYears[1] || "");

  // Commercial year selectors (shared across income & expenses)
  const existingCorpYears = Object.keys(
    (initialValues?.details as CommercialDetails)?.corporateAnnualIncome || {}
  );
  const [corpYear1, setCorpYear1] = useState(existingCorpYears[0] || "");
  const [corpYear2, setCorpYear2] = useState(existingCorpYears[1] || "");

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

  function togglePurposeOfUse(value: string) {
    const d = details as ResidentialDetails;
    const current = d.purposeOfUse || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateDetails("purposeOfUse", updated);
  }

  function toggleIncomeType(value: string) {
    const d = details as ResidentialDetails;
    const current = d.incomeTypes || [];
    const updated = current.includes(value)
      ? current.filter((t) => t !== value)
      : [...current, value];
    updateDetails("incomeTypes", updated);
  }

  function updateAnnualIncome(year: string, raw: string) {
    const digits = raw.replace(/[^0-9]/g, "");
    const formatted = digits ? Number(digits).toLocaleString() : "";
    const d = details as ResidentialDetails;
    const current = d.annualIncome || {};
    updateDetails("annualIncome", { ...current, [year]: formatted });
  }

  function changeIncomeYear(oldYear: string, newYear: string, setYear: (y: string) => void) {
    setYear(newYear);
    const d = details as ResidentialDetails;
    const current = { ...(d.annualIncome || {}) };
    const amount = current[oldYear] || "";
    delete current[oldYear];
    current[newYear] = amount;
    updateDetails("annualIncome", current);
  }

  function updateCommercialYearField(field: "corporateAnnualIncome" | "corporateAnnualExpenses", year: string, raw: string) {
    const digits = raw.replace(/[^0-9]/g, "");
    const formatted = digits ? Number(digits).toLocaleString() : "";
    const d = details as CommercialDetails;
    const current = d[field] || {};
    updateDetails(field, { ...current, [year]: formatted });
  }

  function changeCommercialYear(oldYear: string, newYear: string, setYear: (y: string) => void) {
    setYear(newYear);
    const d = details as CommercialDetails;
    // Move both income and expense values to the new year key
    for (const field of ["corporateAnnualIncome", "corporateAnnualExpenses"] as const) {
      const current = { ...(d[field] || {}) };
      const amount = current[oldYear] || "";
      delete current[oldYear];
      current[newYear] = amount;
      updateDetails(field, current);
    }
  }

  // ── Step validation ────────────────────────────────────────

  function isStep1Valid() {
    return form.productTypes.length > 0;
  }

  function isStep2Valid() {
    if (!form.province || !form.desiredTimeline) return false;
    if (isResidential) {
      const rd = details as ResidentialDetails;
      return (
        (rd.purposeOfUse || []).length > 0 &&
        (rd.incomeTypes || []).length > 0 &&
        !!incomeYear1 &&
        !!(rd.annualIncome || {})[incomeYear1]
      );
    }
    if (isCommercial) {
      return !!(details as CommercialDetails).businessType;
    }
    return true;
  }

  function goNext() {
    if (step < totalSteps) setStep(step + 1);
  }

  function goBack() {
    if (step > 1) setStep(step - 1);
  }

  // ── Submit ──────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    // Validate commercial financials: if income exists for a year, expenses must too
    if (form.mortgageCategory === "COMMERCIAL") {
      const cd = form.details as CommercialDetails;
      const incomeYears = Object.keys(cd.corporateAnnualIncome || {}).filter(
        (y) => (cd.corporateAnnualIncome || {})[y]
      );
      const expenseYears = Object.keys(cd.corporateAnnualExpenses || {}).filter(
        (y) => (cd.corporateAnnualExpenses || {})[y]
      );
      for (const y of incomeYears) {
        if (!expenseYears.includes(y)) {
          setError(t("request.commercialFinancialsHelper"));
          return;
        }
      }
      for (const y of expenseYears) {
        if (!incomeYears.includes(y)) {
          setError(t("request.commercialFinancialsHelper"));
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.somethingWentWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Required marker ────────────────────────────────────────

  const required = <span className="text-rose-500 ml-0.5">*</span>;

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

  // ── Step labels ────────────────────────────────────────────

  const stepLabels = [
    t("request.stepBasics", "Basics"),
    t("request.stepDetails", "Details"),
    t("request.stepReview", "Review & Submit"),
  ];

  // ── Timeline display helper ───────────────────────────────

  const timelineLabels: Record<string, string> = {
    ASAP: t("request.timelineAsap"),
    "1_MONTH": t("request.timeline1Month"),
    "3_MONTHS": t("request.timeline3Months"),
    "6_MONTHS": t("request.timeline6Months"),
    "1_YEAR_PLUS": t("request.timeline1YearPlus"),
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-xl bg-error-50 border border-error-500/20 px-4 py-3 animate-fade-in" role="alert">
          <p className="font-body text-sm text-error-700">{error}</p>
        </div>
      )}

      {/* ── Progress Stepper ──────────────────────────────── */}
      <div className="flex items-center gap-2">
        {stepLabels.map((label, i) => {
          const stepNum = i + 1;
          const isActive = step === stepNum;
          const isCompleted = step > stepNum;
          return (
            <div key={i} className="flex items-center gap-2 flex-1">
              <button
                type="button"
                onClick={() => {
                  // Allow jumping back to completed steps
                  if (isCompleted) setStep(stepNum);
                }}
                className={`flex items-center gap-2.5 ${isCompleted ? "cursor-pointer" : "cursor-default"}`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-display transition-all duration-200 shrink-0 ${
                    isCompleted
                      ? "bg-forest-800 text-cream-100"
                      : isActive
                        ? "bg-forest-800 text-cream-100 ring-4 ring-forest-200"
                        : "bg-cream-300 text-sage-400"
                  }`}
                >
                  {isCompleted ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    stepNum
                  )}
                </div>
                <span className={`font-body text-sm hidden sm:inline ${isActive ? "font-semibold text-forest-800" : isCompleted ? "font-medium text-forest-700" : "text-sage-400"}`}>
                  {label}
                </span>
              </button>
              {i < stepLabels.length - 1 && (
                <div className={`flex-1 h-0.5 rounded-full transition-colors duration-300 ${isCompleted ? "bg-amber-500" : "bg-cream-300"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Basics ────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-8 animate-fade-in">
          {/* Category */}
          <div className="card-elevated">
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

          {/* Product Types */}
          <div className="card-elevated">
            <h2 className="heading-sm mb-1">
              {isResidential ? t("request.residential") : t("request.commercial")}{required}
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

          {/* Step 1 Next */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={goNext}
              disabled={!isStep1Valid()}
              className="btn-primary px-8 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("request.next", "Next")}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Details ───────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-8 animate-fade-in">
          {/* Privacy reminder */}
          <div className="rounded-xl border border-forest-200 bg-forest-50 px-4 py-3 flex items-start gap-3">
            <svg className="h-5 w-5 text-forest-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
            <p className="font-body text-sm text-forest-700">{t("request.privacyReminderFinancial")}</p>
          </div>
          {/* Location */}
          <div className="card-elevated">
            <h2 className="heading-sm mb-4">{t("request.province")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="province" className="label-text">
                  {t("request.province")}{required}
                </label>
                <select
                  id="province"
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

          {/* Category-specific fields */}
          {isResidential ? (
            <div className="card-elevated">
              <h2 className="heading-sm mb-4">{t("request.applicantInfo")}</h2>

              <div className="mb-6">
                <label className="label-text">{t("request.purposeOfUse")}{required}</label>
                <div className="flex gap-3 mt-2">
                  {(["OWNER_OCCUPIED", "RENTAL"] as const).map((value) => {
                    const checked = ((details as ResidentialDetails).purposeOfUse || []).includes(value);
                    return (
                      <label key={value} className={checkboxClass(checked)}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePurposeOfUse(value)}
                          className="h-4 w-4 rounded border-cream-300 text-forest-600 focus:ring-forest-500"
                        />
                        <span className="font-body text-sm text-forest-800">
                          {value === "OWNER_OCCUPIED" ? t("request.ownerOccupied") : t("request.rental")}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="mb-6">
                <label className="label-text">{t("request.incomeType")}{required}</label>
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

              <div>
                <label className="label-text">
                  {t("request.annualIncome")}{required}
                </label>
                <p className="text-body-sm text-sage-500 mt-1 mb-2">
                  {t("request.incomeHelperText")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                  {([
                    { year: incomeYear1, setYear: setIncomeYear1, otherYear: incomeYear2, label: t("request.currentYear") },
                    { year: incomeYear2, setYear: setIncomeYear2, otherYear: incomeYear1, label: t("request.priorYear") },
                  ] as const).map(({ year, setYear, otherYear, label }, idx) => (
                    <div key={idx} className="rounded-xl border border-cream-200 bg-white p-4">
                      <p className="font-body text-xs font-medium text-sage-600 mb-1">{label}</p>
                      <select
                        value={year}
                        onChange={(e) => changeIncomeYear(year, e.target.value, setYear)}
                        className="input-field mb-3 text-sm"
                      >
                        <option value="">{t("request.selectYear")}</option>
                        {getYearOptions().map((y) => (
                          <option key={y} value={y} disabled={y === otherYear}>
                            {y}
                          </option>
                        ))}
                      </select>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-sage-400">$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={((details as ResidentialDetails).annualIncome || {})[year] || ""}
                          onChange={(e) => updateAnnualIncome(year, e.target.value)}
                          placeholder="0"
                          className="input-field pl-7"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="card-elevated">
              <h2 className="heading-sm mb-4">{t("request.businessInfo")}</h2>

              <div className="mb-6">
                <label htmlFor="businessType" className="label-text">
                  {t("request.businessType")}{required}
                </label>
                <input
                  id="businessType"
                  type="text"
                  value={(details as CommercialDetails).businessType || ""}
                  onChange={(e) => updateDetails("businessType", e.target.value)}
                  placeholder={t("request.businessTypePlaceholder")}
                  className="input-field"
                />
              </div>

              <div className="mb-6">
                <label className="label-text">
                  {t("request.corporateFinancials")}{required}
                </label>
                <p className="text-body-sm text-sage-500 mt-1 mb-2">
                  {t("request.commercialFinancialsHelper")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                  {([
                    { year: corpYear1, setYear: setCorpYear1, otherYear: corpYear2 },
                    { year: corpYear2, setYear: setCorpYear2, otherYear: corpYear1 },
                  ] as const).map(({ year, setYear, otherYear }, idx) => (
                    <div key={idx} className="rounded-xl border border-cream-200 bg-white p-4">
                      <select
                        value={year}
                        onChange={(e) => changeCommercialYear(year, e.target.value, setYear)}
                        className="input-field mb-3 text-sm"
                      >
                        <option value="">{t("request.selectYear")}</option>
                        {getYearOptions().map((y) => (
                          <option key={y} value={y} disabled={y === otherYear}>
                            {y}
                          </option>
                        ))}
                      </select>
                      <div className="space-y-2">
                        <div>
                          <label className="font-body text-xs text-sage-500">{t("request.corpIncome")}</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-sage-400">$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={((details as CommercialDetails).corporateAnnualIncome || {})[year] || ""}
                              onChange={(e) => updateCommercialYearField("corporateAnnualIncome", year, e.target.value)}
                              placeholder="0"
                              className="input-field pl-7"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="font-body text-xs text-sage-500">{t("request.corpExpenses")}</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-sage-400">$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={((details as CommercialDetails).corporateAnnualExpenses || {})[year] || ""}
                              onChange={(e) => updateCommercialYearField("corporateAnnualExpenses", year, e.target.value)}
                              placeholder="0"
                              className="input-field pl-7"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="ownerNetIncome" className="label-text">
                  {t("request.ownerNetIncome")}
                </label>
                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-sage-400">$</span>
                  <input
                    id="ownerNetIncome"
                    type="text"
                    inputMode="numeric"
                    value={(details as CommercialDetails).ownerNetIncome || ""}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, "");
                      updateDetails("ownerNetIncome", digits ? Number(digits).toLocaleString() : "");
                    }}
                    placeholder="0"
                    className="input-field pl-7"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="card-elevated">
            <div>
              <label htmlFor="desiredTimeline" className="label-text">
                {t("request.desiredTimeline")}{required}
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
          </div>

          {/* Step 2 navigation */}
          <div className="flex justify-between">
            <button type="button" onClick={goBack} className="btn-ghost">
              {t("request.back", "Back")}
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!isStep2Valid()}
              className="btn-primary px-8 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("request.next", "Next")}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review & Submit ───────────────────────── */}
      {step === 3 && (
        <div className="space-y-8 animate-fade-in">
          {/* Review summary */}
          <div className="card-elevated">
            <div className="flex items-center justify-between mb-6">
              <h2 className="heading-sm">{t("request.reviewTitle", "Review Your Request")}</h2>
            </div>

            <div className="space-y-5">
              {/* Category & Products */}
              <div className="flex items-start justify-between gap-4 pb-5 border-b border-cream-200">
                <div>
                  <p className="font-body text-xs font-medium text-sage-500 uppercase tracking-wide mb-1">
                    {t("request.categoryQuestion")}
                  </p>
                  <p className="font-body text-sm font-semibold text-forest-800">
                    {isResidential ? t("request.residential") : t("request.commercial")}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.productTypes.map((pt) => (
                      <span key={pt} className="inline-flex items-center rounded-full bg-cream-200 px-2.5 py-0.5 font-body text-xs font-medium text-forest-700">
                        {t(PRODUCT_LABEL_KEYS[pt])}
                      </span>
                    ))}
                  </div>
                </div>
                <button type="button" onClick={() => setStep(1)} className="font-body text-xs text-amber-600 hover:text-amber-700 font-medium shrink-0">
                  {t("request.edit", "Edit")}
                </button>
              </div>

              {/* Location */}
              <div className="flex items-start justify-between gap-4 pb-5 border-b border-cream-200">
                <div>
                  <p className="font-body text-xs font-medium text-sage-500 uppercase tracking-wide mb-1">
                    {t("request.province")}
                  </p>
                  <p className="font-body text-sm font-semibold text-forest-800">
                    {form.city ? `${form.city}, ` : ""}{form.province}
                  </p>
                </div>
                <button type="button" onClick={() => setStep(2)} className="font-body text-xs text-amber-600 hover:text-amber-700 font-medium shrink-0">
                  {t("request.edit", "Edit")}
                </button>
              </div>

              {/* Timeline */}
              <div className="flex items-start justify-between gap-4 pb-5 border-b border-cream-200">
                <div>
                  <p className="font-body text-xs font-medium text-sage-500 uppercase tracking-wide mb-1">
                    {t("request.desiredTimeline")}
                  </p>
                  <p className="font-body text-sm font-semibold text-forest-800">
                    {timelineLabels[form.desiredTimeline || ""] || form.desiredTimeline}
                  </p>
                </div>
                <button type="button" onClick={() => setStep(2)} className="font-body text-xs text-amber-600 hover:text-amber-700 font-medium shrink-0">
                  {t("request.edit", "Edit")}
                </button>
              </div>
            </div>
          </div>

          {/* Additional notes */}
          <div className="card-elevated">
            <label htmlFor="notes" className="label-text">
              {t("request.additionalDetailsLabel")}{required}
            </label>
            <p className="font-body text-sm font-medium text-forest-700 mb-2">
              {t("request.additionalDetailsHelper")}
            </p>
            <textarea
              id="notes"
              rows={4}
              required
              value={form.notes || ""}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              className="input-field"
            />
          </div>

          {/* Privacy reminder */}
          <div className="flex items-start gap-3 rounded-xl bg-forest-50 border border-forest-200 p-4">
            <svg className="w-5 h-5 text-forest-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p className="font-body text-sm text-forest-700">
              {t("request.privacyReminder", "Your information stays anonymous until you choose to connect with a broker.")}
            </p>
          </div>

          {/* Step 3 navigation + submit */}
          <div className="flex justify-between">
            <button type="button" onClick={goBack} className="btn-ghost">
              {t("request.back", "Back")}
            </button>
            <button
              type="submit"
              disabled={submitting || !form.notes?.trim()}
              className="btn-amber px-10 py-3.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? (submittingLabel || t("request.submitting"))
                : (submitLabel || t("request.submit"))}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
