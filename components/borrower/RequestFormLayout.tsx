import React, { useMemo } from "react";
import { useTranslation } from "next-i18next";
import type { TFunction } from "i18next";
import { Card, Eyebrow } from "@/components/broker/ui";
import {
  PRODUCT_LABEL_KEYS,
  TIMELINE_LABEL_KEYS,
  INCOME_TYPE_LABEL_KEYS,
} from "@/lib/requestConfig";
import type {
  CreateRequestInput,
  ResidentialDetails,
  CommercialDetails,
} from "@/types";

/**
 * RequestFormLayout — three-column wrapper around <RequestForm>.
 *
 *   ┌───────────┬─────────────────────────┬───────────────┐
 *   │ step rail │  form (children)        │ live summary  │
 *   └───────────┴─────────────────────────┴───────────────┘
 *
 * Reads the current step + form snapshot RequestForm emits via its
 * `onStateChange` prop. Renders the step rail + privacy callout on the left
 * and a live-updating summary on the right. The form remains the single
 * source of truth — this layout only displays.
 *
 * Below `lg`, the layout collapses into a single column: the step indicator
 * and form sit on top, then the summary card stacks beneath.
 */

/**
 * Sticky offset for left rail and right summary on `lg+`.
 *
 * AppTopbar is also `position: sticky; top: 0` and ~92px tall (eyebrow +
 * h1 leading-tight + py-5 padding + 1px border). Without an offset, the
 * sticky panels would slide *behind* the topbar instead of beneath it.
 * 96px gives ~3px of breathing room.
 */
const STICKY_OFFSET = "lg:top-24";

export interface RequestFormLayoutProps {
  step: number;
  totalSteps: number;
  form: CreateRequestInput | null;
  goToStep?: (n: number) => void;
  children: React.ReactNode;
}

export default function RequestFormLayout({
  step,
  totalSteps,
  form,
  goToStep,
  children,
}: RequestFormLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)_300px] lg:gap-8">
        <StepRail step={step} totalSteps={totalSteps} goToStep={goToStep} />
        <div className="min-w-0">{children}</div>
        <LiveSummary form={form} />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// StepRail — vertical 3-step nav matching the design reference.
// On `lg+` it sits in the left column sticky below the topbar.
// Below `lg` it collapses to a slim "STEP n / total" indicator.
// ──────────────────────────────────────────────────────────────
function StepRail({
  step,
  totalSteps,
  goToStep,
}: {
  step: number;
  totalSteps: number;
  goToStep?: (n: number) => void;
}) {
  const { t } = useTranslation("common");

  const steps = useMemo(
    () =>
      [
        {
          label: t("request.stepBasics", "Basics"),
          hint: t("request.stepBasicsHint", "Category & products"),
        },
        {
          label: t("request.stepDetails", "Details"),
          hint: t("request.stepDetailsHint", "Location, income, timeline"),
        },
        {
          label: t("request.stepReview", "Review & Submit"),
          hint: t("request.stepReviewHint", "Confirm and post"),
        },
      ].slice(0, totalSteps),
    [t, totalSteps],
  );

  return (
    <aside className={`lg:sticky ${STICKY_OFFSET} lg:self-start`}>
      <div className="lg:hidden">
        <div className="flex items-center gap-2 font-mono text-[11px] text-sage-500">
          <span className="text-amber-600">●</span>
          {t("request.stepLabel", "STEP {{n}} / {{total}}", {
            n: step,
            total: totalSteps,
          })}
        </div>
      </div>

      <ul className="hidden lg:block">
        {steps.map((s, i) => {
          const num = i + 1;
          const isActive = num === step;
          const isComplete = num < step;
          const clickable = isComplete && !!goToStep;
          return (
            <li key={s.label}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && goToStep!(num)}
                className={`flex w-full items-center gap-3 border-b border-cream-300 py-3.5 text-left transition-colors last:border-b-0 ${
                  clickable
                    ? "cursor-pointer hover:bg-cream-100"
                    : "cursor-default"
                } ${isActive ? "" : "opacity-90"}`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-[12px] font-bold ${
                    isActive || isComplete
                      ? "bg-amber-500 text-white"
                      : "border border-cream-300 bg-cream-50 text-sage-400"
                  }`}
                >
                  {isComplete ? "✓" : num}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate font-body text-[13px] ${
                      isActive
                        ? "font-semibold text-forest-800"
                        : "text-forest-700/80"
                    }`}
                  >
                    {s.label}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-sage-500">
                    {s.hint}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 hidden rounded-sm border border-amber-200 bg-amber-50 p-4 lg:block">
        <Eyebrow className="text-amber-700">
          {t("request.privacyEyebrow", "개인정보")}
        </Eyebrow>
        <p className="mt-2 font-body text-[12px] leading-relaxed text-forest-800/90">
          {t(
            "request.privacy",
            "Your contact details are never shared. All chat stays on mortly.",
          )}
        </p>
      </div>
    </aside>
  );
}

// ──────────────────────────────────────────────────────────────
// LiveSummary — sticky panel that mirrors the full request as the
// borrower fills it. Only sections with data render; layout stays
// proportional regardless of how much has been filled.
// ──────────────────────────────────────────────────────────────
function LiveSummary({ form }: { form: CreateRequestInput | null }) {
  const { t } = useTranslation("common");

  return (
    <aside className={`lg:sticky ${STICKY_OFFSET} lg:self-start`}>
      <Card padding="default">
        <Eyebrow>{t("request.summary", "요청 요약")}</Eyebrow>
        {form ? <SummaryBody form={form} t={t} /> : <SummaryPlaceholder t={t} />}
      </Card>
      <p className="mt-3 px-1 font-body text-[11px] text-sage-500">
        {t(
          "request.summaryNote",
          "This summary updates as you fill out the form.",
        )}
      </p>
    </aside>
  );
}

function SummaryPlaceholder({ t }: { t: TFunction<"common"> }) {
  return (
    <p className="mt-3 font-body text-[13px] text-sage-500">
      {t(
        "request.summaryPlaceholder",
        "Your request summary will appear here as you fill out the form.",
      )}
    </p>
  );
}

// ──────────────────────────────────────────────────────────────
// SummaryBody — derives display sections from the live form
// snapshot. All conditional rendering lives here so the section
// components below are pure.
// ──────────────────────────────────────────────────────────────
function SummaryBody({
  form,
  t,
}: {
  form: CreateRequestInput;
  t: TFunction<"common">;
}) {
  const view = useMemo(() => buildSummaryView(form, t), [form, t]);

  if (view.isEmpty) {
    return <SummaryPlaceholder t={t} />;
  }

  return (
    <>
      <div className="mt-2 font-display text-xl font-semibold leading-tight text-forest-800">
        {view.categoryLabel}
      </div>

      {view.products.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {view.products.map((p) => (
            <Chip key={p}>{p}</Chip>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {view.region && (
          <Section title={t("request.locationSection", "Location")}>
            <Row label={t("request.province", "Region")} value={view.region} />
          </Section>
        )}

        {view.timelineLabel && (
          <Section title={t("request.timelineSection", "Timeline")}>
            <Row
              label={t("request.desiredTimeline", "Timeline")}
              value={view.timelineLabel}
            />
          </Section>
        )}

        {view.applicantRows.length > 0 && (
          <Section title={t("request.applicantInfo", "Applicant")}>
            {view.applicantRows.map((r) => (
              <Row key={r.label} label={r.label} value={r.value} />
            ))}
          </Section>
        )}

        {view.businessRows.length > 0 && (
          <Section title={t("request.businessInfo", "Business")}>
            {view.businessRows.map((r) => (
              <Row key={r.label} label={r.label} value={r.value} />
            ))}
          </Section>
        )}

        {view.corporateRows.length > 0 && (
          <Section
            title={t("request.corporateFinancials", "Corporate financials")}
          >
            {view.corporateRows.map((r) => (
              <Row key={r.label} label={r.label} value={r.value} />
            ))}
          </Section>
        )}

        {view.notesPreview && (
          <Section title={t("request.additionalNotes", "Notes")}>
            <p className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap font-body text-[12px] leading-relaxed text-forest-800/90">
              {view.notesPreview}
            </p>
          </Section>
        )}
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// View-model builder — pure transformation from form state to the
// rows the summary renders. Keeps the component body declarative
// and the math testable in isolation.
// ──────────────────────────────────────────────────────────────
interface SummaryRow {
  label: string;
  value: string;
}

interface SummaryView {
  isEmpty: boolean;
  categoryLabel: string;
  products: string[];
  region: string | null;
  timelineLabel: string | null;
  applicantRows: SummaryRow[];
  businessRows: SummaryRow[];
  corporateRows: SummaryRow[];
  notesPreview: string | null;
}

const NOTES_PREVIEW_LIMIT = 240;

function buildSummaryView(
  form: CreateRequestInput,
  t: TFunction<"common">,
): SummaryView {
  const isCommercial = form.mortgageCategory === "COMMERCIAL";
  const isResidential = form.mortgageCategory === "RESIDENTIAL";

  const categoryLabel = isCommercial
    ? t("request.commercial")
    : t("request.residential");

  const products = (form.productTypes ?? []).map((p) =>
    t(PRODUCT_LABEL_KEYS[p] ?? p),
  );

  const region = formatRegion(form.province, form.city);

  const timelineLabel = form.desiredTimeline
    ? t(TIMELINE_LABEL_KEYS[form.desiredTimeline] ?? form.desiredTimeline)
    : null;

  const rd =
    isResidential ? (form.details as ResidentialDetails | undefined) : undefined;
  const cd =
    isCommercial ? (form.details as CommercialDetails | undefined) : undefined;

  const applicantRows = rd ? buildApplicantRows(rd, t) : [];
  const businessRows = cd ? buildBusinessRows(cd, t) : [];
  const corporateRows = cd ? buildCorporateRows(cd, t) : [];

  const notesPreview = form.notes
    ? form.notes.length > NOTES_PREVIEW_LIMIT
      ? `${form.notes.slice(0, NOTES_PREVIEW_LIMIT).trimEnd()}…`
      : form.notes
    : null;

  const isEmpty =
    !form.mortgageCategory &&
    products.length === 0 &&
    !region &&
    !timelineLabel &&
    applicantRows.length === 0 &&
    businessRows.length === 0 &&
    corporateRows.length === 0 &&
    !notesPreview;

  return {
    isEmpty,
    categoryLabel,
    products,
    region,
    timelineLabel,
    applicantRows,
    businessRows,
    corporateRows,
    notesPreview,
  };
}

function formatRegion(province?: string, city?: string | null): string | null {
  const trimmedCity = city?.trim();
  const trimmedProvince = province?.trim();
  if (trimmedCity && trimmedProvince) return `${trimmedCity}, ${trimmedProvince}`;
  return trimmedCity || trimmedProvince || null;
}

function buildApplicantRows(
  details: ResidentialDetails,
  t: TFunction<"common">,
): SummaryRow[] {
  const rows: SummaryRow[] = [];

  if (details.purposeOfUse?.length) {
    rows.push({
      label: t("request.purposeOfUse", "Purpose"),
      value: details.purposeOfUse
        .map((v) =>
          v === "OWNER_OCCUPIED"
            ? t("request.ownerOccupied")
            : t("request.rental"),
        )
        .join(", "),
    });
  }

  if (details.incomeTypes?.length) {
    rows.push({
      label: t("request.incomeType", "Income"),
      value: details.incomeTypes
        .map((it) => t(INCOME_TYPE_LABEL_KEYS[it] ?? it))
        .join(", "),
    });
  }

  if (details.incomeTypeOther?.trim()) {
    rows.push({
      label: t("request.incomeTypes.other", "Other"),
      value: details.incomeTypeOther.trim(),
    });
  }

  // All filled income years, newest first.
  const years = filledYears(details.annualIncome);
  for (const year of years) {
    rows.push({
      label: year,
      value: `$${details.annualIncome[year]}`,
    });
  }

  return rows;
}

function buildBusinessRows(
  details: CommercialDetails,
  t: TFunction<"common">,
): SummaryRow[] {
  const rows: SummaryRow[] = [];
  if (details.businessType?.trim()) {
    rows.push({
      label: t("request.businessType", "Type"),
      value: details.businessType.trim(),
    });
  }
  if (details.ownerNetIncome?.trim()) {
    rows.push({
      label: t("request.ownerNetIncome", "Owner net"),
      value: `$${details.ownerNetIncome.trim()}`,
    });
  }
  return rows;
}

function buildCorporateRows(
  details: CommercialDetails,
  t: TFunction<"common">,
): SummaryRow[] {
  // Union of years across income + expenses, sorted newest first. A year
  // appears only if either field has a value.
  const incomeMap = (details.corporateAnnualIncome ?? {}) as Record<string, string>;
  const expenseMap = (details.corporateAnnualExpenses ?? {}) as Record<string, string>;
  const years = Array.from(
    new Set([...Object.keys(incomeMap), ...Object.keys(expenseMap)]),
  )
    .filter((y) => incomeMap[y] || expenseMap[y])
    .sort()
    .reverse();

  return years.map((year) => {
    const inc = incomeMap[year];
    const exp = expenseMap[year];
    const incomePart = inc
      ? `${t("request.corpIncome", "Inc")} $${inc}`
      : null;
    const expensePart = exp
      ? `${t("request.corpExpenses", "Exp")} $${exp}`
      : null;
    return {
      label: year,
      value: [incomePart, expensePart].filter(Boolean).join(" · ") || "—",
    };
  });
}

function filledYears(map: Record<string, string> | undefined): string[] {
  if (!map) return [];
  return Object.entries(map)
    .filter(([, v]) => v && v.trim() !== "")
    .map(([y]) => y)
    .sort()
    .reverse();
}

// ──────────────────────────────────────────────────────────────
// Presentational primitives — pure, no logic.
// ──────────────────────────────────────────────────────────────
function Section({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-cream-200 pt-3 first:border-t-0 first:pt-0">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-700/80">
        {title}
      </div>
      <dl>{children}</dl>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-sage-500">
        {label}
      </dt>
      <dd className="text-right font-body text-[13px] font-medium text-forest-800">
        {value || (
          <span className="font-body text-[12px] italic text-sage-400">—</span>
        )}
      </dd>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-sm border border-cream-300 bg-cream-100 px-1.5 py-0.5 font-body text-[11px] text-forest-700">
      {children}
    </span>
  );
}
