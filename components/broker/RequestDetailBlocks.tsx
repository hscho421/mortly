import React from "react";
import { useTranslation } from "next-i18next";
import type { TFunction } from "i18next";
import type { ResidentialDetails, CommercialDetails } from "@/types";
import {
  INCOME_TYPE_LABEL_KEYS,
  TIMELINE_LABEL_KEYS,
} from "@/lib/requestConfig";

/**
 * Shared request-detail rendering blocks.
 *
 * Both /broker/requests/[id] and the messages right-side context panel render
 * the same borrower-submitted request data (income tables, purpose-of-use,
 * corporate financials, notes, timeline). Keeping the presentation in one
 * place guarantees they stay in sync: when a new field appears in the
 * borrower form it only needs to land here once.
 *
 * Components are intentionally Tailwind-only; they don't depend on global
 * `.card-*` utilities so they work as sub-blocks inside different container
 * sizes (wide card on the detail page, narrow panel in messages).
 */

type Translator = TFunction<"common">;

// ── DetailBlock — label + value cell for the 2-col grid ──
export function DetailBlock({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-cream-300 bg-cream-100 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-sage-500">
        {label}
      </div>
      <div className="mt-1 font-body text-sm font-medium text-forest-800">
        {value}
      </div>
    </div>
  );
}

// ── ResidentialBlocks ────────────────────────────────────────
export function ResidentialBlocks({
  details,
  t,
}: {
  details: ResidentialDetails | null | undefined;
  t: Translator;
}) {
  if (!details) return null;
  const purpose = Array.isArray(details.purposeOfUse)
    ? details.purposeOfUse
        .map((v) =>
          v === "OWNER_OCCUPIED"
            ? t("request.ownerOccupied")
            : t("request.rental"),
        )
        .join(", ")
    : details.purposeOfUse === "OWNER_OCCUPIED"
      ? t("request.ownerOccupied")
      : t("request.rental");
  const incomes = (details.incomeTypes ?? [])
    .map((it) => t(INCOME_TYPE_LABEL_KEYS[it] ?? it))
    .join(", ");
  const incomesDisplay =
    incomes + (details.incomeTypeOther ? ` (${details.incomeTypeOther})` : "") ||
    t("request.notSpecified");
  return (
    <>
      <DetailBlock label={t("request.purposeOfUse")} value={purpose} />
      <DetailBlock label={t("request.incomeType")} value={incomesDisplay} />
      <div className="sm:col-span-2">
        <IncomeTable
          title={t("request.annualIncome")}
          yearHeader={t("request.selectYear")}
          data={details.annualIncome}
          t={t}
        />
      </div>
    </>
  );
}

// ── CommercialBlocks ─────────────────────────────────────────
export function CommercialBlocks({
  details,
  t,
}: {
  details: CommercialDetails | null | undefined;
  t: Translator;
}) {
  if (!details) return null;
  return (
    <>
      <DetailBlock
        label={t("request.businessType")}
        value={details.businessType || t("request.notSpecified")}
      />
      <DetailBlock
        label={t("request.ownerNetIncome")}
        value={
          details.ownerNetIncome
            ? `$${details.ownerNetIncome}`
            : t("request.notSpecified")
        }
      />
      <div className="sm:col-span-2">
        <CorporateFinancialsTable
          details={details}
          t={t}
        />
      </div>
    </>
  );
}

// ── IncomeTable (single-column, residential) ─────────────────
function IncomeTable({
  title,
  yearHeader,
  data,
  t,
}: {
  title: React.ReactNode;
  yearHeader: React.ReactNode;
  data: Record<string, string> | string | null | undefined;
  t: Translator;
}) {
  return (
    <div className="rounded-sm border border-cream-300 bg-cream-100 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-sage-500">
        {title}
      </div>
      {data && typeof data === "object" ? (
        <table className="mt-2 w-full font-body text-sm">
          <thead>
            <tr className="border-b border-cream-300">
              <th className="py-1 pr-4 text-left font-medium text-sage-500">
                {yearHeader}
              </th>
              <th className="py-1 text-right font-medium text-sage-500">
                {title}
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([year, amount]) => (
                <tr key={year} className="border-b border-cream-200 last:border-0">
                  <td className="py-1.5 pr-4 text-forest-800">{year}</td>
                  <td className="py-1.5 text-right font-medium text-forest-800">
                    ${amount || "—"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-1 font-body text-sm font-medium text-forest-800">
          {(typeof data === "string" && data) || t("request.notSpecified")}
        </p>
      )}
    </div>
  );
}

// ── CorporateFinancialsTable (three-column, commercial) ──────
function CorporateFinancialsTable({
  details,
  t,
}: {
  details: CommercialDetails;
  t: Translator;
}) {
  const income = details.corporateAnnualIncome as
    | Record<string, string>
    | null
    | undefined;
  const expenses =
    (details.corporateAnnualExpenses as Record<string, string> | null | undefined) ??
    {};
  return (
    <div className="rounded-sm border border-cream-300 bg-cream-100 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-sage-500">
        {t("request.corporateFinancials")}
      </div>
      {income && typeof income === "object" ? (
        <table className="mt-2 w-full font-body text-sm">
          <thead>
            <tr className="border-b border-cream-300">
              <th className="py-1 pr-4 text-left font-medium text-sage-500">
                {t("request.selectYear")}
              </th>
              <th className="py-1 px-4 text-right font-medium text-sage-500">
                {t("request.corpIncome")}
              </th>
              <th className="py-1 pl-4 text-right font-medium text-sage-500">
                {t("request.corpExpenses")}
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(income)
              .sort()
              .reverse()
              .map((year) => (
                <tr key={year} className="border-b border-cream-200 last:border-0">
                  <td className="py-1.5 pr-4 text-forest-800">{year}</td>
                  <td className="py-1.5 px-4 text-right font-medium text-forest-800">
                    ${income[year] || "—"}
                  </td>
                  <td className="py-1.5 pl-4 text-right font-medium text-forest-800">
                    ${expenses[year] || "—"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-1 font-body text-sm text-forest-800">
          {t("request.notSpecified")}
        </p>
      )}
    </div>
  );
}

// ── Compact notes block — full text, scrollable if long ──
export function NotesBlock({
  notes,
  compact = false,
}: {
  notes: string | null | undefined;
  compact?: boolean;
}) {
  const { t } = useTranslation("common");
  if (!notes) return null;
  return (
    <div className="rounded-sm border border-cream-300 bg-cream-100 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-sage-500">
        {t("request.additionalNotes")}
      </div>
      <p
        className={`mt-2 whitespace-pre-wrap font-body ${
          compact ? "max-h-40 overflow-y-auto text-[13px]" : "text-sm"
        } leading-relaxed text-forest-800`}
      >
        {notes}
      </p>
    </div>
  );
}

// ── Timeline label helper ──
export function timelineLabel(
  timeline: string | null | undefined,
  t: Translator,
): string | null {
  if (!timeline) return null;
  return t(TIMELINE_LABEL_KEYS[timeline] ?? timeline);
}
