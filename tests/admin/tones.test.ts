import { describe, it, expect } from "vitest";
import {
  toneForUserStatus,
  toneForRole,
  toneForVerification,
  toneForTier,
  toneForRequestStatus,
  toneForConversationStatus,
  toneForReportStatus,
} from "@/components/admin/primitives";

describe("admin tone helpers", () => {
  it("toneForUserStatus", () => {
    expect(toneForUserStatus("ACTIVE")).toBe("success");
    expect(toneForUserStatus("SUSPENDED")).toBe("warn");
    expect(toneForUserStatus("BANNED")).toBe("danger");
    expect(toneForUserStatus("???")).toBe("neutral");
  });

  it("toneForRole", () => {
    expect(toneForRole("ADMIN")).toBe("dark");
    expect(toneForRole("BROKER")).toBe("accent");
    expect(toneForRole("BORROWER")).toBe("neutral");
  });

  it("toneForVerification", () => {
    expect(toneForVerification("VERIFIED")).toBe("success");
    expect(toneForVerification("PENDING")).toBe("warn");
    expect(toneForVerification("REJECTED")).toBe("danger");
  });

  it("toneForTier", () => {
    expect(toneForTier("PREMIUM")).toBe("accent");
    expect(toneForTier("PRO")).toBe("info");
    expect(toneForTier("FREE")).toBe("neutral");
  });

  it("toneForRequestStatus", () => {
    expect(toneForRequestStatus("OPEN")).toBe("accent");
    expect(toneForRequestStatus("IN_PROGRESS")).toBe("warn");
    expect(toneForRequestStatus("PENDING_APPROVAL")).toBe("warn");
    expect(toneForRequestStatus("REJECTED")).toBe("danger");
    expect(toneForRequestStatus("CLOSED")).toBe("neutral");
  });

  it("toneForConversationStatus", () => {
    expect(toneForConversationStatus("ACTIVE")).toBe("info");
    expect(toneForConversationStatus("CLOSED")).toBe("neutral");
  });

  it("toneForReportStatus", () => {
    expect(toneForReportStatus("OPEN")).toBe("danger");
    expect(toneForReportStatus("REVIEWED")).toBe("warn");
    expect(toneForReportStatus("RESOLVED")).toBe("success");
    expect(toneForReportStatus("DISMISSED")).toBe("neutral");
  });
});
