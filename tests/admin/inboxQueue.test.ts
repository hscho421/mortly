import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchInboxQueue } from "@/lib/admin/inboxQueue";

describe("fetchInboxQueue (Phase 3: /api/admin/queue single-call)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("makes exactly ONE GET to /api/admin/queue (not 3 separate list endpoints)", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          pendingBrokers: [],
          openReports: [],
          pendingRequests: [],
          counts: {
            pendingBrokers: 0,
            openReports: 0,
            pendingRequests: 0,
            total: 0,
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await fetchInboxQueue();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as unknown as [string];
    expect(call[0]).toBe("/api/admin/queue");
  });

  it("maps queue response into InboxRow[] and sorts by createdAt desc", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            pendingRequests: [
              {
                id: "req_1",
                publicId: "100000001",
                createdAt: "2025-01-01T00:00:00.000Z",
                status: "PENDING_APPROVAL",
                province: "ON",
                city: "Toronto",
                mortgageCategory: "RESIDENTIAL",
                productTypes: ["NEW"],
                notes: null,
                details: null,
                borrower: { id: "u_1", name: "Bob", email: "bob@x" },
              },
            ],
            pendingBrokers: [
              {
                id: "brk_1",
                publicId: "200000001",
                createdAt: "2025-01-03T00:00:00.000Z",
                brokerageName: "Acme",
                licenseNumber: "L1",
                province: "ON",
                subscriptionTier: "FREE",
                yearsExperience: 2,
                user: { publicId: "200000001", name: "Jane", email: "j@x" },
              },
            ],
            openReports: [
              {
                id: "rep_abcd1234",
                publicId: "rep_abcd1234",
                createdAt: "2025-01-02T00:00:00.000Z",
                reason: "bad",
                targetType: "BROKER",
                targetId: "200000001",
                status: "OPEN",
                reporter: { id: "u_2", name: "Carol", email: "c@x" },
              },
            ],
            counts: {
              pendingBrokers: 1,
              openReports: 1,
              pendingRequests: 1,
              total: 3,
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const rows = await fetchInboxQueue();
    expect(rows).toHaveLength(3);
    // Sort order: newest first
    expect(rows[0].kind).toBe("BRK");
    expect(rows[1].kind).toBe("REP");
    expect(rows[2].kind).toBe("REQ");
    // REP publicId is synthesized
    expect(rows[1].publicId).toBe("REP-1234");
    // REQ fields are preserved
    if (rows[2].kind === "REQ") {
      expect(rows[2].status).toBe("PENDING_APPROVAL");
      expect(rows[2].borrower.id).toBe("u_1");
    }
  });

  it("throws a descriptive error when the queue endpoint is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("gone", { status: 500 })),
    );
    await expect(fetchInboxQueue()).rejects.toThrow(/queue endpoint returned 500/);
  });
});
