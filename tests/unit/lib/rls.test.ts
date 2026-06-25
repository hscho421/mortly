import { describe, it, expect } from "vitest";
import { isRlsLeaking, summarizeProbe } from "@/lib/rls";

describe("RLS smoke-check evaluation", () => {
  it("flags 200-with-rows as leaking (RLS off)", () => {
    expect(isRlsLeaking(200, [{ id: "x" }])).toBe(true);
  });

  it("treats 200-with-empty-array as secure (RLS filtered all rows)", () => {
    expect(isRlsLeaking(200, [])).toBe(false);
  });

  it("treats 401/403/404 as secure", () => {
    for (const status of [401, 403, 404]) {
      expect(isRlsLeaking(status, { message: "permission denied" })).toBe(false);
    }
  });

  it("non-array 200 body is not treated as a leak", () => {
    expect(isRlsLeaking(200, { message: "ok" })).toBe(false);
  });

  it("summarizeProbe reports a leak with the row count", () => {
    const r = summarizeProbe({ table: "messages", status: 200, body: [{ id: 1 }, { id: 2 }] });
    expect(r.ok).toBe(false);
    expect(r.message).toContain("2 row");
    expect(r.message).toContain("messages");
  });

  it("summarizeProbe reports OK when the anon key is denied", () => {
    const r = summarizeProbe({ table: "conversations", status: 401, body: { message: "no" } });
    expect(r.ok).toBe(true);
    expect(r.message).toContain("OK");
  });
});
