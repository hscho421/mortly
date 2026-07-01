import type { TFunction } from "i18next";
import { statusMeta, isActiveStatus } from "@/lib/requestStatus";
import { productOptions, provinceOptions, incomeOptions } from "@/lib/requestOptions";

// Minimal t(): returns the default string (2nd arg), mirroring t(key, fallback).
const t = ((key: string, def?: string) => def ?? key) as unknown as TFunction;

describe("requestStatus", () => {
  it("maps status → tone + localized label", () => {
    expect(statusMeta("OPEN", t)).toEqual({ label: "OPEN", tone: "success" });
    expect(statusMeta("PENDING_APPROVAL", t).tone).toBe("gold");
    expect(statusMeta("REJECTED", t).tone).toBe("error");
    expect(statusMeta("WHATEVER", t).tone).toBe("neutral");
  });

  it("isActiveStatus is OPEN/IN_PROGRESS only", () => {
    expect(isActiveStatus("OPEN")).toBe(true);
    expect(isActiveStatus("IN_PROGRESS")).toBe(true);
    expect(isActiveStatus("CLOSED")).toBe(false);
    expect(isActiveStatus("EXPIRED")).toBe(false);
  });
});

describe("requestOptions", () => {
  it("product options differ by category", () => {
    const res = productOptions("RESIDENTIAL", t).map((o) => o.value);
    const comm = productOptions("COMMERCIAL", t).map((o) => o.value);
    expect(res).toContain("NEW_MORTGAGE");
    expect(comm).toContain("COMM_NEW_LOAN");
    expect(res).not.toContain("COMM_NEW_LOAN");
  });

  it("lists all 13 provinces and the income types", () => {
    expect(provinceOptions()).toHaveLength(13);
    expect(incomeOptions(t).map((o) => o.value)).toContain("EMPLOYMENT");
  });
});
