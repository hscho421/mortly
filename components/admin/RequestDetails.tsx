import { useTranslation } from "next-i18next";
import {
  INCOME_TYPE_LABEL_KEYS,
  PRODUCT_LABEL_KEYS,
  TIMELINE_LABEL_KEYS,
} from "@/lib/requestConfig";

/**
 * Shared renderer for the full borrower-request input surface, used by the
 * admin Activity drawer and Inbox drawer. Prior to this component both
 * surfaces only rendered a thin field slice — admins never saw income type,
 * annual income, business type, corporate financials, owner net income, or
 * purposeOfUse. This renders every field the borrower actually fills in
 * (see `components/RequestForm.tsx`).
 *
 * Missing / empty fields are silently skipped — the renderer only shows
 * sections that have content. This keeps short requests from showing a wall
 * of em-dashes while still revealing every piece of data the borrower gave.
 */

export interface RequestDetailsProps {
  mortgageCategory: "RESIDENTIAL" | "COMMERCIAL" | string;
  productTypes?: string[] | null;
  province?: string | null;
  city?: string | null;
  desiredTimeline?: string | null;
  notes?: string | null;
  rejectionReason?: string | null;
  details?: Record<string, unknown> | null;
  /** Compact view for the inbox drawer (narrower column). */
  compact?: boolean;
}

type TFn = ReturnType<typeof useTranslation>["t"];

export default function RequestDetails({
  mortgageCategory,
  productTypes,
  province,
  city,
  desiredTimeline,
  notes,
  rejectionReason,
  details,
  compact,
}: RequestDetailsProps) {
  const { t } = useTranslation("common");
  const isCommercial = mortgageCategory === "COMMERCIAL";
  const d = details ?? {};

  const surface = "bg-cream-100 border border-cream-300";
  const sectionSpacing = compact ? "mt-3" : "mt-4";
  const innerPad = compact ? "p-3" : "p-3.5";

  const region = [city, province].filter(Boolean).join(", ") || "—";

  const basePairs: Array<[string, string]> = [
    [t("admin.request.field.region", "지역"), region],
    [
      t("admin.request.field.type", "유형"),
      isCommercial
        ? t("request.commercial", "상업용")
        : t("request.residential", "주거용"),
    ],
  ];
  if (desiredTimeline) {
    basePairs.push([
      t("admin.request.field.timeline", "시기"),
      t(TIMELINE_LABEL_KEYS[desiredTimeline] ?? desiredTimeline, desiredTimeline),
    ]);
  }

  return (
    <div>
      <div className={`${surface} ${innerPad}`}>
        <div className="grid grid-cols-2 gap-3">
          {basePairs.map(([k, v]) => (
            <Field key={k} label={k} value={v} />
          ))}
        </div>

        {Array.isArray(productTypes) && productTypes.length > 0 && (
          <div className="mt-3 pt-3 border-t border-cream-300">
            <Label>{t("admin.request.field.products", "상품")}</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {productTypes.map((pt) => (
                <ProductChip key={pt} label={t(PRODUCT_LABEL_KEYS[pt] ?? pt, pt)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {isCommercial
        ? renderCommercial(d, t, { sectionSpacing, surface, innerPad })
        : renderResidential(d, t, { sectionSpacing, surface, innerPad })}

      {notes && (
        <div className={`${sectionSpacing} ${surface} ${innerPad}`}>
          <Label>{t("admin.request.field.notes", "신청인 메모")}</Label>
          <Italic>{notes}</Italic>
        </div>
      )}

      {rejectionReason && (
        <div className={`${sectionSpacing} bg-error-50 border border-error-100 ${innerPad}`}>
          <Label tone="danger">
            {t("admin.request.field.rejectionReason", "반려 사유")}
          </Label>
          <ItalicDanger>{rejectionReason}</ItalicDanger>
        </div>
      )}
    </div>
  );
}

// ── Sub-renderers ────────────────────────────────────────────────

interface Spacing {
  sectionSpacing: string;
  surface: string;
  innerPad: string;
}

function renderResidential(
  d: Record<string, unknown>,
  t: TFn,
  s: Spacing,
): React.ReactNode {
  const sections: React.ReactNode[] = [];

  if (Array.isArray(d.purposeOfUse) && d.purposeOfUse.length > 0) {
    sections.push(
      <div key="purposeOfUse" className={`${s.sectionSpacing} ${s.surface} ${s.innerPad}`}>
        <Label>{t("request.purposeOfUse", "사용 목적")}</Label>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {(d.purposeOfUse as string[]).map((v) => {
            const label =
              v === "OWNER_OCCUPIED"
                ? t("request.ownerOccupied", "거주용")
                : v === "RENTAL"
                ? t("request.rental", "임대용")
                : v;
            return <Tag key={v} label={label} />;
          })}
        </div>
      </div>,
    );
  }

  const incomeTypes = Array.isArray(d.incomeTypes) ? (d.incomeTypes as string[]) : [];
  if (incomeTypes.length > 0) {
    sections.push(
      <div key="incomeTypes" className={`${s.sectionSpacing} ${s.surface} ${s.innerPad}`}>
        <Label>{t("request.incomeType", "소득 유형")}</Label>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {incomeTypes.map((v) => (
            <Tag
              key={v}
              label={t(INCOME_TYPE_LABEL_KEYS[v] ?? v, v)}
              tone="accent"
            />
          ))}
        </div>
        {incomeTypes.includes("OTHER") && typeof d.incomeTypeOther === "string" && d.incomeTypeOther.length > 0 && (
          <div className="mt-2">
            <Label>{t("request.incomeTypeOther", "기타 소득")}</Label>
            <Value>{d.incomeTypeOther}</Value>
          </div>
        )}
      </div>,
    );
  }

  const annualIncome = (d.annualIncome as Record<string, string> | undefined) ?? null;
  if (annualIncome && Object.keys(annualIncome).length > 0) {
    const years = Object.keys(annualIncome).sort((a, b) => b.localeCompare(a));
    sections.push(
      <div key="annualIncome" className={`${s.sectionSpacing} ${s.surface} ${s.innerPad}`}>
        <Label>{t("request.annualIncome", "연 소득")}</Label>
        <table className="w-full text-[12px] mt-1.5">
          <thead>
            <tr className="border-b border-cream-300 font-mono text-[10px] text-sage-500 uppercase tracking-[0.1em]">
              <th className="text-left py-1 pr-3 font-normal">
                {t("request.selectYear", "연도")}
              </th>
              <th className="text-right py-1 font-normal">
                {t("request.annualIncome", "연 소득")}
              </th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y} className="border-b border-cream-200 last:border-b-0">
                <td className="py-1.5 pr-3 font-mono">{y}</td>
                <td className="py-1.5 text-right font-medium font-mono">
                  {annualIncome[y] ? `$${annualIncome[y]}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
  }

  return <>{sections}</>;
}

function renderCommercial(
  d: Record<string, unknown>,
  t: TFn,
  s: Spacing,
): React.ReactNode {
  const sections: React.ReactNode[] = [];

  if (typeof d.businessType === "string" && d.businessType.length > 0) {
    sections.push(
      <div key="businessType" className={`${s.sectionSpacing} ${s.surface} ${s.innerPad}`}>
        <Label>{t("request.businessType", "사업 유형")}</Label>
        <Value>{d.businessType as string}</Value>
      </div>,
    );
  }

  const income =
    (d.corporateAnnualIncome as Record<string, string> | undefined) ?? null;
  const expenses =
    (d.corporateAnnualExpenses as Record<string, string> | undefined) ?? null;
  const corpYears = new Set<string>();
  if (income) for (const y of Object.keys(income)) corpYears.add(y);
  if (expenses) for (const y of Object.keys(expenses)) corpYears.add(y);
  if (corpYears.size > 0) {
    const sortedYears = [...corpYears].sort((a, b) => b.localeCompare(a));
    sections.push(
      <div key="corporate" className={`${s.sectionSpacing} ${s.surface} ${s.innerPad}`}>
        <Label>{t("request.corporateFinancials", "법인 재무")}</Label>
        <table className="w-full text-[12px] mt-1.5">
          <thead>
            <tr className="border-b border-cream-300 font-mono text-[10px] text-sage-500 uppercase tracking-[0.1em]">
              <th className="text-left py-1 pr-3 font-normal">
                {t("request.selectYear", "연도")}
              </th>
              <th className="text-right py-1 px-3 font-normal">
                {t("request.corpIncome", "소득")}
              </th>
              <th className="text-right py-1 pl-3 font-normal">
                {t("request.corpExpenses", "지출")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedYears.map((y) => (
              <tr key={y} className="border-b border-cream-200 last:border-b-0">
                <td className="py-1.5 pr-3 font-mono">{y}</td>
                <td className="py-1.5 px-3 text-right font-mono">
                  {income && income[y] ? `$${income[y]}` : "—"}
                </td>
                <td className="py-1.5 pl-3 text-right font-mono">
                  {expenses && expenses[y] ? `$${expenses[y]}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
  }

  const owner = d.ownerNetIncome;
  if (owner !== null && owner !== undefined && String(owner).length > 0) {
    sections.push(
      <div key="ownerNetIncome" className={`${s.sectionSpacing} ${s.surface} ${s.innerPad}`}>
        <Label>{t("request.ownerNetIncome", "대표 순소득")}</Label>
        <Value>
          {typeof owner === "number"
            ? `$${owner.toLocaleString()}`
            : `$${String(owner)}`}
        </Value>
      </div>,
    );
  }

  return <>{sections}</>;
}

// ── Building blocks ──────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Value>{value || "—"}</Value>
    </div>
  );
}

function Label({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <div
      className={`font-mono text-[9px] uppercase tracking-[0.15em] ${
        tone === "danger" ? "text-error-700" : "text-sage-500"
      }`}
    >
      {children}
    </div>
  );
}

function Value({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] font-medium mt-0.5 text-forest-800 truncate">
      {children}
    </div>
  );
}

function Italic({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] text-forest-700/80 italic mt-1 leading-relaxed whitespace-pre-wrap">
      &ldquo;{children}&rdquo;
    </div>
  );
}

function ItalicDanger({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] text-error-700 italic mt-1 leading-relaxed whitespace-pre-wrap">
      &ldquo;{children}&rdquo;
    </div>
  );
}

function Tag({ label, tone }: { label: string; tone?: "accent" }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-sm border font-mono text-[10px] font-semibold tracking-[0.1em] uppercase ${
        tone === "accent"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-cream-200 text-forest-700 border-cream-300"
      }`}
    >
      {label}
    </span>
  );
}

function ProductChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-forest-200 bg-cream-50 text-forest-800 text-[11px]">
      {label}
    </span>
  );
}
