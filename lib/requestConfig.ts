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
  "SMALL_BUSINESS_LOAN",
  "COMMERCIAL_LOC",
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
  SMALL_BUSINESS_LOAN: "request.product.smallBusinessLoan",
  COMMERCIAL_LOC: "request.product.commercialLoc",
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
 * v2: "Residential Request" or "Commercial Request"
 * v1: requestType as title-case (e.g. "Purchase")
 */
export function getRequestTitle(request: {
  schemaVersion?: number | null;
  mortgageCategory?: string | null;
  requestType?: string | null;
}): string {
  if (request.schemaVersion === 2) {
    return request.mortgageCategory === "COMMERCIAL"
      ? "Commercial Request"
      : "Residential Request";
  }
  // v1 fallback
  const rt = request.requestType || "REQUEST";
  return rt.charAt(0) + rt.slice(1).toLowerCase();
}

export function isV2Request(request: { schemaVersion?: number | null; productTypes?: string[] | null }): boolean {
  return request.schemaVersion === 2 || (request.productTypes != null && request.productTypes.length > 0);
}
