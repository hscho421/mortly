// Shared types + fetcher for /admin/inbox (and the ⌘K palette, later).
// The Inbox merges three disjoint queues into one list sorted by age.
//
// Phase 3: switched from a 3-way fan-out against the public list endpoints
// (`/api/admin/requests`, `/brokers`, `/reports`) to a single call against
// `/api/admin/queue`, which returns all three queues in one round-trip.

export type InboxKind = "REQ" | "BRK" | "REP";

export interface InboxRequestRow {
  kind: "REQ";
  id: string; // internal cuid
  publicId: string; // 9-digit
  createdAt: string;
  status: string;
  province: string;
  city: string | null;
  mortgageCategory: "RESIDENTIAL" | "COMMERCIAL";
  productTypes: string[];
  notes: string | null;
  details: unknown;
  borrower: { id: string; name: string | null; email: string };
}

export interface InboxBrokerRow {
  kind: "BRK";
  id: string; // broker id
  publicId: string; // user.publicId
  createdAt: string;
  brokerageName: string;
  province: string;
  licenseNumber: string;
  subscriptionTier: string;
  yearsExperience: number | null;
  user: { publicId: string; name: string | null };
}

export interface InboxReportRow {
  kind: "REP";
  id: string; // report id
  publicId: string; // synthetic "REP-xxx" using report.id slice
  createdAt: string;
  reason: string;
  targetType: string;
  targetId: string; // resolved publicId from queue endpoint
  reporter: { id: string; name: string | null; email: string };
}

export type InboxRow = InboxRequestRow | InboxBrokerRow | InboxReportRow;

// ── Queue-endpoint response shape ────────────────────────────────────

interface QueueBroker {
  id: string;
  publicId: string;
  createdAt: string;
  brokerageName: string | null;
  licenseNumber: string | null;
  province: string | null;
  subscriptionTier: string | null;
  yearsExperience: number | null;
  user: { publicId: string; name: string | null; email: string };
}

interface QueueReport {
  id: string;
  publicId: string;
  createdAt: string;
  reason: string;
  targetType: string;
  targetId: string;
  status: string;
  reporter: { id: string; name: string | null; email: string } | null;
}

interface QueueRequest {
  id: string;
  publicId: string;
  createdAt: string;
  status: string;
  province: string;
  city: string | null;
  mortgageCategory: "RESIDENTIAL" | "COMMERCIAL";
  productTypes: string[];
  notes: string | null;
  details: unknown;
  borrower: { id: string; name: string | null; email: string };
}

interface QueueResponse {
  pendingBrokers: QueueBroker[];
  openReports: QueueReport[];
  pendingRequests: QueueRequest[];
  counts: {
    pendingBrokers: number;
    openReports: number;
    pendingRequests: number;
    total: number;
  };
}

export async function fetchInboxQueue(): Promise<InboxRow[]> {
  const r = await fetch("/api/admin/queue");
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(
      `queue endpoint returned ${r.status}${body ? ` · ${body.slice(0, 120)}` : ""}`,
    );
  }
  const data = (await r.json()) as QueueResponse;

  const rows: InboxRow[] = [
    ...data.pendingRequests.map<InboxRequestRow>((r) => ({
      kind: "REQ",
      id: r.id,
      publicId: r.publicId,
      createdAt: r.createdAt,
      status: r.status,
      province: r.province,
      city: r.city,
      mortgageCategory: r.mortgageCategory,
      productTypes: r.productTypes,
      notes: r.notes,
      details: r.details,
      borrower: r.borrower,
    })),
    ...data.pendingBrokers.map<InboxBrokerRow>((b) => ({
      kind: "BRK",
      id: b.id,
      publicId: b.publicId,
      createdAt: b.createdAt,
      brokerageName: b.brokerageName ?? "",
      province: b.province ?? "",
      licenseNumber: b.licenseNumber ?? "",
      subscriptionTier: b.subscriptionTier ?? "FREE",
      yearsExperience: b.yearsExperience,
      user: { publicId: b.user.publicId, name: b.user.name },
    })),
    ...data.openReports.map<InboxReportRow>((r) => ({
      kind: "REP",
      id: r.id,
      // The inbox UI expects a synthesized short code for display.
      publicId: `REP-${r.id.slice(-4).toUpperCase()}`,
      createdAt: r.createdAt,
      reason: r.reason,
      targetType: r.targetType,
      targetId: r.targetId,
      reporter: r.reporter ?? { id: "", name: null, email: "" },
    })),
  ];

  rows.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  return rows;
}

/** High priority if the row is less than 2 hours old. */
export function isPriority(row: InboxRow, now = Date.now()): boolean {
  const age = now - new Date(row.createdAt).getTime();
  return age < 2 * 60 * 60 * 1000;
}

export function formatAge(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간`;
  const days = Math.floor(hrs / 24);
  return `${days}일`;
}
