import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/tests/mocks/prisma";
import "@/tests/mocks/next-auth";
import { prismaMock } from "@/tests/mocks/prisma";
import { setSession, adminSession } from "@/tests/mocks/next-auth";
import { makeReqRes } from "@/tests/utils/apiHelpers";
import { makeBorrowerRequest } from "@/tests/fixtures/requests";

vi.mock("@/lib/notify", () => ({ notifyUser: vi.fn(async () => undefined) }));
vi.mock("@/lib/realtime", () => ({ notifyConversations: vi.fn() }));

import handler from "@/pages/api/admin/requests/[id]";

// The window MUST be stamped on approval unconditionally — the feature toggle is
// NOT read here (a cached toggle read previously let a just-approved request miss
// its window, leaving approvedAt null → visible to all tiers). Read-time gates
// handle the on/off behavior; the toggle handler releases the backlog on enable.
describe("admin approval stamps the premium window (always)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession(adminSession());
    prismaMock.adminAction.create.mockResolvedValue({} as never);
    prismaMock.borrowerRequest.update.mockResolvedValue(
      makeBorrowerRequest({ status: "OPEN" }) as never,
    );
  });

  it("stamps approvedAt + clears premiumReleasedAt when a PENDING request is approved", async () => {
    prismaMock.borrowerRequest.findUnique.mockResolvedValue(
      makeBorrowerRequest({ status: "PENDING_APPROVAL", approvedAt: null, premiumReleasedAt: null }),
    );

    const { req, res } = makeReqRes({
      method: "PUT",
      query: { id: "300000001" },
      body: { status: "OPEN" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const updateArgs = prismaMock.borrowerRequest.update.mock.calls[0][0];
    expect(updateArgs.data.status).toBe("OPEN");
    expect(updateArgs.data.approvedAt).toBeInstanceOf(Date);
    expect(updateArgs.data.premiumReleasedAt).toBeNull();
  });

  it("does NOT re-stamp when the request is already OPEN (no window reset)", async () => {
    prismaMock.borrowerRequest.findUnique.mockResolvedValue(
      makeBorrowerRequest({ status: "OPEN" }),
    );

    const { req, res } = makeReqRes({
      method: "PUT",
      query: { id: "300000001" },
      body: { status: "OPEN" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const updateArgs = prismaMock.borrowerRequest.update.mock.calls[0][0];
    expect(updateArgs.data.approvedAt).toBeUndefined();
    expect(updateArgs.data).not.toHaveProperty("premiumReleasedAt");
  });
});
