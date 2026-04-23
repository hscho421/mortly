import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub Resend so we can observe what the broadcast helper sends.
const resendSend = vi.fn(async () => ({ id: "rsnd_abc" }));
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: resendSend },
  })),
}));

import { notifyAdminsOfNewAdmin } from "@/lib/email";

describe("notifyAdminsOfNewAdmin", () => {
  beforeEach(() => {
    resendSend.mockClear();
  });

  it("sends one email per existing-admin recipient", async () => {
    await notifyAdminsOfNewAdmin({
      recipients: ["a@x.com", "b@x.com", "c@x.com"],
      newAdmin: { name: "Jane", email: "jane@x.com", publicId: "123" },
      createdBy: { id: "u1", name: "Alice", email: "alice@x.com" },
    });
    expect(resendSend).toHaveBeenCalledTimes(3);
    const tos = resendSend.mock.calls.map((c) => (c[0] as { to: string }).to);
    expect(tos.sort()).toEqual(["a@x.com", "b@x.com", "c@x.com"]);
  });

  it("no-ops with empty recipient list", async () => {
    await notifyAdminsOfNewAdmin({
      recipients: [],
      newAdmin: { name: "n", email: "n@x", publicId: "9" },
      createdBy: { id: "u", name: "c", email: "c@x" },
    });
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("includes the new-admin details + creator in the HTML body", async () => {
    await notifyAdminsOfNewAdmin({
      recipients: ["peer@x.com"],
      newAdmin: { name: "Jane Smith", email: "jane@x.com", publicId: "555555555" },
      createdBy: { id: "u", name: "Alice", email: "alice@x.com" },
    });
    const payload = resendSend.mock.calls[0][0] as {
      subject: string;
      html: string;
    };
    expect(payload.subject).toContain("Jane Smith");
    expect(payload.html).toContain("Jane Smith");
    expect(payload.html).toContain("jane@x.com");
    expect(payload.html).toContain("555555555");
    expect(payload.html).toContain("Alice");
  });

  it("escapes HTML in admin-controlled text (new admin name)", async () => {
    await notifyAdminsOfNewAdmin({
      recipients: ["peer@x.com"],
      newAdmin: {
        name: '<script>alert("xss")</script>',
        email: "x@x.com",
        publicId: "1",
      },
      createdBy: { id: "u", name: null, email: "c@x.com" },
    });
    const payload = resendSend.mock.calls[0][0] as { html: string };
    expect(payload.html).not.toContain("<script>alert");
    expect(payload.html).toContain("&lt;script&gt;");
  });

  it("individual recipient failure doesn't abort the batch", async () => {
    resendSend
      .mockRejectedValueOnce(new Error("bounce"))
      .mockResolvedValueOnce({ id: "ok1" })
      .mockResolvedValueOnce({ id: "ok2" });
    await expect(
      notifyAdminsOfNewAdmin({
        recipients: ["bad@x.com", "ok1@x.com", "ok2@x.com"],
        newAdmin: { name: "n", email: "n@x", publicId: "1" },
        createdBy: { id: "u", name: null, email: "c@x" },
      }),
    ).resolves.toBeUndefined();
    expect(resendSend).toHaveBeenCalledTimes(3);
  });
});
