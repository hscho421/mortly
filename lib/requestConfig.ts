// ── Product type constants ────────────────────────────────────

export const RESIDENTIAL_PRODUCTS = [
  "NEW_MORTGAGE",
  "PRE_APPROVAL",
  "REFINANCING",
  "RENEWAL",
  "PERSONAL_LOC",
  "REVERSE_MORTGAGE",
  "DEBT_CONSOLIDATION",
  "EQUITY_LOAN",
] as const;

export const COMMERCIAL_PRODUCTS = [
  "COMM_NEW_LOAN",
  "COMM_REFINANCING",
  "COMM_TRANSFER",
  "COMM_GOVT_LOAN",
  "COMM_LOC",
  "COMM_DEBT_CONSOLIDATION",
] as const;

export type ResidentialProduct = (typeof RESIDENTIAL_PRODUCTS)[number];
export type CommercialProduct = (typeof COMMERCIAL_PRODUCTS)[number];

// ── Income type constants ─────────────────────────────────────

export const INCOME_TYPES = [
  "EMPLOYMENT",
  "SELF_EMPLOYMENT",
  "DIVIDEND",
  "RENTAL",
  "FOREIGN",
  "OTHER",
] as const;

export type IncomeType = (typeof INCOME_TYPES)[number];

// ── Translation key maps ──────────────────────────────────────

export const PRODUCT_LABEL_KEYS: Record<string, string> = {
  NEW_MORTGAGE: "request.product.newMortgage",
  PRE_APPROVAL: "request.product.preApproval",
  REFINANCING: "request.product.refinancing",
  RENEWAL: "request.product.renewal",
  PERSONAL_LOC: "request.product.personalLoc",
  REVERSE_MORTGAGE: "request.product.reverseMortgage",

  DEBT_CONSOLIDATION: "request.product.debtConsolidation",
  EQUITY_LOAN: "request.product.equityLoan",
  COMM_NEW_LOAN: "request.product.commNewLoan",
  COMM_REFINANCING: "request.product.commRefinancing",
  COMM_TRANSFER: "request.product.commTransfer",
  COMM_GOVT_LOAN: "request.product.commGovtLoan",
  COMM_LOC: "request.product.commLoc",
  COMM_DEBT_CONSOLIDATION: "request.product.commDebtConsolidation",
};

export const INCOME_TYPE_LABEL_KEYS: Record<string, string> = {
  EMPLOYMENT: "request.incomeTypes.employment",
  SELF_EMPLOYMENT: "request.incomeTypes.selfEmployment",
  DIVIDEND: "request.incomeTypes.dividend",
  RENTAL: "request.incomeTypes.rental",
  FOREIGN: "request.incomeTypes.foreign",
  OTHER: "request.incomeTypes.other",
};

// ── Timeline options ──────────────────────────────────────

export const TIMELINE_OPTIONS = [
  "ASAP",
  "1_MONTH",
  "3_MONTHS",
  "6_MONTHS",
  "1_YEAR_PLUS",
] as const;

export const TIMELINE_LABEL_KEYS: Record<string, string> = {
  ASAP: "request.timelineAsap",
  "1_MONTH": "request.timeline1Month",
  "3_MONTHS": "request.timeline3Months",
  "6_MONTHS": "request.timeline6Months",
  "1_YEAR_PLUS": "request.timeline1YearPlus",
};

// ── Canadian provinces & territories ──────────────────────────
// Single source of truth — the borrower form had all 13, while the three
// broker surfaces (browse filter, onboarding, profile) listed only 10
// (missing the territories), so a borrower in Yukon could never be matched
// by a broker filtering on province. Import this everywhere instead of
// re-declaring local arrays.

export const PROVINCES = [
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
] as const;

const provinceSet = new Set<string>(PROVINCES);

export function isValidProvince(p: unknown): p is string {
  return typeof p === "string" && provinceSet.has(p);
}

const timelineSet = new Set<string>(TIMELINE_OPTIONS);

export function isValidTimeline(t: unknown): boolean {
  return typeof t === "string" && timelineSet.has(t);
}

const incomeTypeSet = new Set<string>(INCOME_TYPES);

export function areValidIncomeTypes(types: unknown): boolean {
  return (
    Array.isArray(types) &&
    types.length > 0 &&
    types.every((t) => typeof t === "string" && incomeTypeSet.has(t))
  );
}

// ── Validation helpers ────────────────────────────────────────

const residentialSet = new Set<string>(RESIDENTIAL_PRODUCTS);
const commercialSet = new Set<string>(COMMERCIAL_PRODUCTS);

export function getProductsForCategory(category: string): readonly string[] {
  return category === "COMMERCIAL" ? COMMERCIAL_PRODUCTS : RESIDENTIAL_PRODUCTS;
}

export function validateProductTypes(category: string, products: string[]): boolean {
  const allowed = category === "COMMERCIAL" ? commercialSet : residentialSet;
  return products.length > 0 && products.every((p) => allowed.has(p));
}

// ── Display helpers ───────────────────────────────────────────

/**
 * Get a display-friendly request title.
 */
export function getRequestTitle(request: {
  mortgageCategory?: string | null;
}): string {
  return request.mortgageCategory === "COMMERCIAL"
    ? "Commercial Request"
    : "Residential Request";
}
