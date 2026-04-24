import { describe, it, expect } from "vitest";
import * as ui from "@/components/ui";

/**
 * Smoke test for the shared UI kit re-export layer. Ensures borrower/broker
 * pages can import primitives from `@/components/ui` without pulling from
 * the admin tree directly.
 */
describe("components/ui re-export layer", () => {
  it("exposes admin primitives under public names", () => {
    expect(ui.UBadge).toBeDefined();
    expect(ui.UBtn).toBeDefined();
    expect(ui.UCard).toBeDefined();
    expect(ui.UAvatar).toBeDefined();
    expect(ui.USectionHead).toBeDefined();
    expect(ui.UTabs).toBeDefined();
    expect(ui.UConfirmDialog).toBeDefined();
    expect(ui.UDrawerError).toBeDefined();
    expect(ui.UEmpty).toBeDefined();
    expect(ui.USpark).toBeDefined();
    expect(ui.FilterChip).toBeDefined();
  });

  it("exposes tone helpers", () => {
    expect(ui.toneForUserStatus).toBeDefined();
    expect(ui.toneForRole).toBeDefined();
    expect(ui.toneForVerification).toBeDefined();
    expect(ui.toneForTier).toBeDefined();
    expect(ui.toneForRequestStatus).toBeDefined();
    expect(ui.toneForConversationStatus).toBeDefined();
    expect(ui.toneForReportStatus).toBeDefined();
  });

  it("exposes the Banner primitive", () => {
    expect(ui.Banner).toBeDefined();
  });
});
