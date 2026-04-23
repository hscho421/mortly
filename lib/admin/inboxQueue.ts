// Shared types + fetchers used by /admin/inbox and (eventually) the ⌘K palette.
// The Inbox merges three disjoint queues into one list sorted by age.

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
  targetId: string; // already-resolved publicId from the reports endpoint
  reporter: { id: string; name: string | null; email: string };
}

export type InboxRow = InboxRequestRow | InboxBrokerRow | InboxReportRow;

interface Paginated<T> {
  data: T[];
  pagination?: unknown;
}

interface AdminRequestRow {
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

interface AdminBrokerRow {
  id: string;
  createdAt: string;
  brokerageName: string;
  province: string;
  licenseNumber: string;
  subscriptionTier: string;
  yearsExperience: number | null;
  user: { publicId: string; name: string | null };
}

interface AdminReportRow {
  id: string;
  createdAt: string;
  reason: string;
  targetType: string;
  targetId: string;
  reporter: { id: string; name: string | null; email: string };
}

export async function fetchInboxQueue(): Promise<InboxRow[]> {
  const endpoints = [
    "/api/admin/requests?status=PENDING_APPROVAL&limit=25",
    "/api/admin/brokers?status=PENDING&limit=25",
    "/api/admin/reports?status=OPEN&limit=25",
  ] as const;

  const [reqRes, brkRes, repRes] = await Promise.all(endpoints.map((u) => fetch(u)));

  // Short-circuit loud: if any source is 4xx/5xx, fail the whole queue so the
  // UI shows a real error instead of a confusing "empty" queue.
  const failed = [reqRes, brkRes, repRes].findIndex((r) => !r.ok);
  if (failed !== -1) {
    const bad = [reqRes, brkRes, repRes][failed];
    const body = await bad.text().catch(() => "");
    throw new Error(
      `inbox source ${endpoints[failed]} returned ${bad.status}${body ? ` · ${body.slice(0, 120)}` : ""}`,
    );
  }

  const [reqs, brks, reps] = (await Promise.all([
    reqRes.json(),
    brkRes.json(),
    repRes.json(),
  ])) as [Paginated<AdminRequestRow>, Paginated<AdminBrokerRow>, Paginated<AdminReportRow>];

  const rows: InboxRow[] = [
    ...reqs.data.map<InboxRequestRow>((r) => ({ ...r, kind: "REQ" })),
    ...brks.data.map<InboxBrokerRow>((b) => ({
      ...b,
      kind: "BRK",
      publicId: b.user.publicId,
    })),
    ...reps.data.map<InboxReportRow>((r) => ({
      ...r,
      kind: "REP",
      publicId: `REP-${r.id.slice(-4).toUpperCase()}`,
    })),
  ];

  // Sort: most recent first.
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
