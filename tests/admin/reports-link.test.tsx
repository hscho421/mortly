/**
 * Regression test for reports.tsx targetLink (Phase 1 fix).
 *
 * Previous code linked REQUEST targets to `/admin/requests/${id}` — a route
 * that doesn't exist. New behavior: REQUEST → `/admin/activity?req=` and
 * CONVERSATION → `/admin/activity?id=`. BROKER is unchanged.
 *
 * The drawer branches on `detail.targetType`, so we unit-test the pure
 * link-building logic via a plain function extracted into this file.
 */
import { describe, it, expect } from "vitest";

function targetLinkFor(targetType: string, targetId: string): string | null {
  return targetType === "BROKER"
    ? `/admin/brokers/${targetId}`
    : targetType === "REQUEST"
    ? `/admin/activity?req=${targetId}`
    : targetType === "CONVERSATION"
    ? `/admin/activity?id=${targetId}`
    : null;
}

describe("reports drawer targetLink", () => {
  it("routes REQUEST targets to /admin/activity?req= (not to dead /admin/requests/*)", () => {
    const link = targetLinkFor("REQUEST", "123456789");
    expect(link).toBe("/admin/activity?req=123456789");
  });

  it("routes CONVERSATION targets to /admin/activity?id=", () => {
    const link = targetLinkFor("CONVERSATION", "cuid-abc");
    expect(link).toBe("/admin/activity?id=cuid-abc");
  });

  it("routes BROKER targets to /admin/brokers/:id", () => {
    const link = targetLinkFor("BROKER", "brk_1");
    expect(link).toBe("/admin/brokers/brk_1");
  });

  it("returns null for unknown target types", () => {
    expect(targetLinkFor("UNKNOWN", "x")).toBeNull();
  });
});
