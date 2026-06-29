import { describe, it, expect } from "vitest";
import { continentOf, countryName, COUNTRY_CONTINENT } from "@/lib/geo/countries";

describe("lib/geo/countries", () => {
  describe("continentOf", () => {
    it("maps known countries to their continent slug", () => {
      expect(continentOf("CA")).toBe("northAmerica");
      expect(continentOf("US")).toBe("northAmerica");
      expect(continentOf("KR")).toBe("asia");
      expect(continentOf("FR")).toBe("europe");
      expect(continentOf("BR")).toBe("southAmerica");
      expect(continentOf("AU")).toBe("oceania");
      expect(continentOf("ZA")).toBe("africa");
    });

    it("is case-insensitive", () => {
      expect(continentOf("ca")).toBe("northAmerica");
    });

    it("falls back to 'other' for null/undefined/unknown codes", () => {
      expect(continentOf(null)).toBe("other");
      expect(continentOf(undefined)).toBe("other");
      expect(continentOf("ZZ")).toBe("other");
    });

    it("covers the full country set", () => {
      expect(Object.keys(COUNTRY_CONTINENT).length).toBeGreaterThan(150);
    });
  });

  describe("countryName", () => {
    it("localizes alpha-2 codes in English", () => {
      expect(countryName("CA", "en")).toBe("Canada");
      expect(countryName("KR", "en")).toBe("South Korea");
      expect(countryName("US", "en")).toBe("United States");
    });

    it("localizes alpha-2 codes in Korean", () => {
      expect(countryName("CA", "ko")).toBe("캐나다");
      expect(countryName("KR", "ko")).toBe("대한민국");
    });

    it("is case-insensitive on the code", () => {
      expect(countryName("ca", "en")).toBe("Canada");
    });

    it("defaults to English when no language is given", () => {
      expect(countryName("CA")).toBe("Canada");
    });

    it("returns an em-dash for empty input", () => {
      expect(countryName(null)).toBe("—");
      expect(countryName(undefined)).toBe("—");
    });

    it("uses the provided fallback for empty input", () => {
      expect(countryName("", "en", "FB")).toBe("FB");
    });
  });
});
