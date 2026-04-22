import { describe, it, expect } from "vitest";
import { CURRENT_LEGAL_VERSION, createLegalAcceptanceMetadata } from "@/lib/legal";

describe("legal", () => {
  it("exposes a current legal version string in YYYY-MM-DD form", () => {
    expect(CURRENT_LEGAL_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("createLegalAcceptanceMetadata includes the current version and a timestamp", () => {
    const meta = createLegalAcceptanceMetadata();
    expect(meta.legalVersion).toBe(CURRENT_LEGAL_VERSION);
    expect(meta.legalAcceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // Must parse as a valid date.
    expect(Number.isNaN(new Date(meta.legalAcceptedAt).getTime())).toBe(false);
  });
});
