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
  it("labels COMMERCIAL correctly", () => {
    expect(getRequestTitle({ mortgageCategory: "COMMERCIAL" })).toBe("Commercial Request");
  });

  it("labels RESIDENTIAL (and unknown) as residential", () => {
    expect(getRequestTitle({ mortgageCategory: "RESIDENTIAL" })).toBe("Residential Request");
    expect(getRequestTitle({})).toBe("Residential Request");
    expect(getRequestTitle({ mortgageCategory: null })).toBe("Residential Request");
  });
});
