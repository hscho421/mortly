import { describe, it, expect } from "vitest";
import {
  validateProductTypes,
  getProductsForCategory,
  getRequestTitle,
  RESIDENTIAL_PRODUCTS,
  COMMERCIAL_PRODUCTS,
} from "@/lib/requestConfig";

describe("validateProductTypes", () => {
  it("accepts all residential products under RESIDENTIAL", () => {
    expect(validateProductTypes("RESIDENTIAL", [...RESIDENTIAL_PRODUCTS])).toBe(true);
  });

  it("accepts all commercial products under COMMERCIAL", () => {
    expect(validateProductTypes("COMMERCIAL", [...COMMERCIAL_PRODUCTS])).toBe(true);
  });

  it("rejects commercial product under RESIDENTIAL", () => {
    expect(validateProductTypes("RESIDENTIAL", ["COMM_NEW_LOAN"])).toBe(false);
  });

  it("rejects residential product under COMMERCIAL", () => {
    expect(validateProductTypes("COMMERCIAL", ["NEW_MORTGAGE"])).toBe(false);
  });

  it("rejects empty array", () => {
    expect(validateProductTypes("RESIDENTIAL", [])).toBe(false);
  });

  it("rejects unknown strings even within correct category", () => {
    expect(validateProductTypes("RESIDENTIAL", ["NEW_MORTGAGE", "NOT_A_REAL_PRODUCT"])).toBe(false);
  });

  it("treats unknown category as residential (default branch)", () => {
    // Guards against typos silently falling to a permissive default.
    expect(validateProductTypes("SOMETHING_ELSE", ["COMM_NEW_LOAN"])).toBe(false);
    expect(validateProductTypes("SOMETHING_ELSE", ["NEW_MORTGAGE"])).toBe(true);
  });
});

describe("getProductsForCategory", () => {
  it("returns commercial list for COMMERCIAL", () => {
    expect(getProductsForCategory("COMMERCIAL")).toEqual(COMMERCIAL_PRODUCTS);
  });

  it("returns residential list otherwise", () => {
    expect(getProductsForCategory("RESIDENTIAL")).toEqual(RESIDENTIAL_PRODUCTS);
    expect(getProductsForCategory("")).toEqual(RESIDENTIAL_PRODUCTS);
  });
});

describe("getRequestTitle", () => {
  type TFn = Parameters<typeof getRequestTitle>[1];
  // Stub t: return the English fallback (mirrors next-i18next t(key, fallback)).
  const t = ((_key: string, fallback?: string) => fallback ?? _key) as unknown as TFn;

  it("labels COMMERCIAL correctly", () => {
    expect(getRequestTitle({ mortgageCategory: "COMMERCIAL" }, t)).toBe("Commercial Request");
  });

  it("labels RESIDENTIAL (and unknown) as residential", () => {
    expect(getRequestTitle({ mortgageCategory: "RESIDENTIAL" }, t)).toBe("Residential Request");
    expect(getRequestTitle({}, t)).toBe("Residential Request");
    expect(getRequestTitle({ mortgageCategory: null }, t)).toBe("Residential Request");
  });

  it("uses the translator for the category label", () => {
    const ko = ((key: string) =>
      key === "requestTitle.commercial" ? "상업용 요청" : "주거용 요청") as unknown as TFn;
    expect(getRequestTitle({ mortgageCategory: "COMMERCIAL" }, ko)).toBe("상업용 요청");
    expect(getRequestTitle({ mortgageCategory: "RESIDENTIAL" }, ko)).toBe("주거용 요청");
  });
});
