import { describe, it, expect } from "vitest";
import type { NextApiRequest } from "next";
import {
  buildAdminActionCreate,
  getRequestMeta,
  validateText,
  MAX_REASON_LEN,
  MAX_NOTES_LEN,
} from "@/lib/admin/audit";

function req(
  headers: Record<string, string | string[] | undefined>,
  remoteAddress?: string,
): NextApiRequest {
  return {
    headers,
    socket: { remoteAddress },
  } as unknown as NextApiRequest;
}

describe("getRequestMeta", () => {
  it("returns x-forwarded-for first value when present", () => {
    const meta = getRequestMeta(
      req({
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
        "user-agent": "Mozilla/TestAgent",
      }),
    );
    expect(meta.ip).toBe("1.2.3.4");
    expect(meta.userAgent).toBe("Mozilla/TestAgent");
  });

  it("falls back to socket.remoteAddress when x-forwarded-for is missing", () => {
    const meta = getRequestMeta(req({ "user-agent": "ua" }, "9.9.9.9"));
    expect(meta.ip).toBe("9.9.9.9");
  });

  it("falls back to 'unknown' when all IP sources missing", () => {
    const meta = getRequestMeta(req({}));
    expect(meta.ip).toBe("unknown");
    expect(meta.userAgent).toBe("unknown");
  });

  it("truncates user-agent at 200 chars", () => {
    const long = "x".repeat(400);
    const meta = getRequestMeta(req({ "user-agent": long }));
    expect(meta.userAgent.length).toBe(200);
  });

  it("handles x-forwarded-for as an array header", () => {
    const meta = getRequestMeta(req({ "x-forwarded-for": ["10.0.0.1", "10.0.0.2"] }));
    expect(meta.ip).toBe("10.0.0.1");
  });
});

describe("buildAdminActionCreate", () => {
  it("serializes details + request meta into a JSON string", () => {
    const args = buildAdminActionCreate(
      req({ "x-forwarded-for": "1.2.3.4", "user-agent": "ua" }),
      { user: { id: "admin_1" } },
      {
        action: "SUSPEND_USER",
        targetType: "USER",
        targetId: "100000001",
        details: { previousStatus: "ACTIVE", newStatus: "SUSPENDED" },
        reason: "Spam",
      },
    );
    expect(args.data.adminId).toBe("admin_1");
    expect(args.data.action).toBe("SUSPEND_USER");
    expect(args.data.targetId).toBe("100000001");
    const details = JSON.parse(args.data.details as string);
    expect(details).toEqual({
      previousStatus: "ACTIVE",
      newStatus: "SUSPENDED",
      requestIp: "1.2.3.4",
      userAgent: "ua",
    });
    expect(args.data.reason).toBe("Spam");
  });

  it("handles missing details + reason cleanly", () => {
    const args = buildAdminActionCreate(
      req({ "user-agent": "ua" }),
      { user: { id: "a" } },
      {
        action: "X",
        targetType: "USER",
        targetId: "t",
      },
    );
    expect(args.data.reason).toBeNull();
    const details = JSON.parse(args.data.details as string);
    expect(details).toEqual({ requestIp: "unknown", userAgent: "ua" });
  });
});

describe("validateText", () => {
  it("returns null for null/undefined", () => {
    expect(validateText(null, 10, "x")).toBeNull();
    expect(validateText(undefined, 10, "x")).toBeNull();
  });
  it("returns the string when under the cap", () => {
    expect(validateText("hi", 10, "x")).toBe("hi");
  });
  it("returns an error when over the cap", () => {
    const v = validateText("a".repeat(MAX_REASON_LEN + 1), MAX_REASON_LEN, "reason");
    expect(v).toEqual({ error: `reason too long (max ${MAX_REASON_LEN})` });
  });
  it("returns an error for non-strings", () => {
    expect(validateText(123, 10, "reason")).toEqual({
      error: "reason must be a string",
    });
  });
  it("accepts exact-cap length", () => {
    expect(validateText("a".repeat(MAX_NOTES_LEN), MAX_NOTES_LEN, "adminNotes")).toBe(
      "a".repeat(MAX_NOTES_LEN),
    );
  });
});
