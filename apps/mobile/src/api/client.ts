import { API_URL } from "@/config";

/**
 * Typed API client for the existing Next.js backend (pages/api/*).
 *
 * Auth: the app's minted next-auth JWT is sent as `Authorization: Bearer`. RN
 * (iOS) won't reliably send a manual Cookie header, so a tiny Next middleware
 * translates the Bearer token into the session cookie that getServerSession
 * reads — every existing endpoint authenticates the app with no per-route change.
 *
 * Errors: the backend returns `{ error: "<SENTINEL_CODE>" }`; we surface that
 * code on ApiError so screens map it to the shared i18n copy.
 *
 * CSRF: every request sends `x-mortly-mobile: 1`, which the backend treats as a
 * trusted mobile client and lets past its same-origin check — so mutations
 * (POST/PUT/DELETE) work without a browser Origin.
 */

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    /** The parsed response body (e.g. to read a `code: "ACTIVE_REQUEST_CAP"`). */
    public body?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

export interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  /** Explicit token; defaults to none (unauthenticated) — pass the session token for authed calls. */
  token?: string | null;
  signal?: AbortSignal;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-mortly-mobile": "1",
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(typeof data.error === "string" ? data.error : "REQUEST_FAILED", res.status, data);
  }
  return data as T;
}

/** POST /api/auth/mobile-login → { sessionToken, user }. Throws ApiError(code). */
export async function loginWithPassword(email: string, password: string) {
  return api<{ sessionToken: string; user: import("@/auth/session").SessionUser }>(
    "/api/auth/mobile-login",
    { method: "POST", body: { email, password } },
  );
}

/** GET /api/users/me → the fresh current user (reflects role/name/status changes). */
export async function getMe(token: string) {
  return api<{ user: import("@/auth/session").SessionUser & { status: string } }>(
    "/api/users/me",
    { token },
  );
}

/** POST /api/auth/select-role → picks BORROWER/BROKER once; returns a refreshed token. */
export async function selectRole(token: string, role: "BORROWER" | "BROKER") {
  return api<{ success: boolean; role: string; sessionToken?: string }>(
    "/api/auth/select-role",
    { method: "POST", token, body: { role } },
  );
}

/** PATCH /api/users/me → sets the display name; returns a refreshed token + user. */
export async function updateName(token: string, name: string) {
  return api<{ success: boolean; sessionToken?: string; user: import("@/auth/session").SessionUser }>(
    "/api/users/me",
    { method: "PATCH", token, body: { name } },
  );
}

/**
 * DELETE /api/users/me → in-app account deletion (App Store 5.1.1). Credentials
 * accounts must supply `currentPassword`; OAuth-only accounts use `ack`. We send
 * both so the server applies whichever branch fits.
 */
export async function deleteAccount(token: string, currentPassword?: string) {
  return api<{ success: boolean }>("/api/users/me", {
    method: "DELETE",
    token,
    body: { ...(currentPassword ? { currentPassword } : {}), ack: "DELETE_MY_ACCOUNT" },
  });
}

// ── Borrower requests ────────────────────────────────────────────────────────
export interface ConversationSummary {
  id: string;
  createdAt: string;
  status: "ACTIVE" | "CLOSED";
  brokerId: string;
  broker: {
    id: string;
    brokerageName: string;
    verificationStatus: string;
    yearsExperience: number | null;
    specialties: string | null;
    bio: string | null;
    profilePhoto: string | null;
    updatedAt: string;
    user: { id: string; publicId: string; name: string | null };
  };
  _count: { messages: number };
}

export interface BorrowerRequest {
  id: string;
  publicId: string;
  mortgageCategory: "RESIDENTIAL" | "COMMERCIAL";
  productTypes: string[];
  province: string;
  city: string | null;
  desiredTimeline: string | null;
  notes: string | null;
  details: Record<string, unknown> | null;
  status: string;
  rejectionReason?: string | null;
  createdAt: string;
  _count?: { conversations: number };
  /** Present on the detail endpoint (GET /api/requests/:id) — broker responses. */
  conversations?: ConversationSummary[];
}

export interface CreateRequestInput {
  mortgageCategory: "RESIDENTIAL" | "COMMERCIAL";
  productTypes: string[];
  province: string;
  city?: string;
  desiredTimeline?: string;
  notes?: string;
  details?: Record<string, unknown>;
}

/** GET /api/requests → the signed-in borrower's own requests. */
export async function getMyRequests(token: string) {
  return api<{
    data: BorrowerRequest[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>("/api/requests", { token });
}

/** POST /api/requests → create a borrower request (201 → the created request). */
export async function createRequest(token: string, input: CreateRequestInput) {
  return api<BorrowerRequest>("/api/requests", { method: "POST", token, body: input });
}

/** GET /api/requests/[id] → one request (borrower detail). */
export async function getRequest(token: string, id: string) {
  return api<BorrowerRequest>(`/api/requests/${id}`, { token });
}

// ── Broker ───────────────────────────────────────────────────────────────────
export interface BrokerProfile {
  id: string;
  userId: string;
  brokerageName: string;
  province: string;
  phone: string | null;
  licenseNumber: string | null;
  bio: string | null;
  yearsExperience: number | null;
  areasServed: string | null;
  specialties: string | null;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  subscriptionTier: "FREE" | "BASIC" | "PRO" | "PREMIUM";
  responseCredits: number;
  mortgageCategory: string | null;
  profilePhoto: string | null;
  subscription: { status: string; tier: string } | null;
  user: { id: string; publicId: string; name: string | null; email: string };
}

export interface BrokerProfileUpdate {
  brokerageName?: string;
  province?: string;
  phone?: string;
  licenseNumber?: string;
  bio?: string;
  areasServed?: string;
  specialties?: string;
  yearsExperience?: number | null;
  mortgageCategory?: string;
}

/** PUT /api/brokers/profile — edit the broker's own profile (partial). */
export async function updateBrokerProfile(token: string, fields: BrokerProfileUpdate) {
  return api<BrokerProfile>("/api/brokers/profile", { method: "PUT", token, body: fields });
}

/** A request in the broker feed — base fields + broker enrichment. */
export interface BrokerFeedRequest extends BorrowerRequest {
  isNew: boolean;
  hasMyConversation: boolean;
  isPremiumExclusive: boolean;
  premiumWindowEndsAt: string | null;
}

/** GET /api/brokers/profile → the broker's own profile (404 → not onboarded). */
export async function getBrokerProfile(token: string) {
  return api<BrokerProfile>("/api/brokers/profile", { token });
}

/** GET /api/requests (broker branch) → the feed of OPEN requests + enrichment. */
export async function getBrokerFeed(
  token: string,
  opts: { province?: string; mortgageCategory?: string; page?: number } = {},
) {
  const p = new URLSearchParams();
  if (opts.province) p.set("province", opts.province);
  if (opts.mortgageCategory) p.set("mortgageCategory", opts.mortgageCategory);
  if (opts.page) p.set("page", String(opts.page));
  const qs = p.toString();
  return api<{
    data: BrokerFeedRequest[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    newCount?: number;
  }>(`/api/requests${qs ? `?${qs}` : ""}`, { token });
}

/** POST /api/conversations → respond to a request (201 new / 200 existing). */
export async function respondToRequest(token: string, requestId: string, message?: string) {
  return api<{ id: string; publicId: string; requestId: string; status: string }>(
    "/api/conversations",
    { method: "POST", token, body: { requestId, ...(message ? { message } : {}) } },
  );
}

/** POST /api/brokers/requests/:id/mark-seen — mark one request seen (on detail open). */
export async function markRequestSeen(token: string, id: string) {
  return api<{ success: boolean }>(`/api/brokers/requests/${id}/mark-seen`, { method: "POST", token });
}

// ── Conversations / chat (shared borrower + broker) ──────────────────────────
export interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  conversationId: string;
  isSystem: boolean;
  sender?: { id: string; name: string | null; role: string };
}

interface ChatParty {
  id: string;
  publicId?: string;
  name: string | null;
}
interface ChatBroker extends ChatParty {
  brokerageName: string;
  verificationStatus: string;
  profilePhoto: string | null;
  userId?: string;
  user: { id: string; publicId: string; name: string | null };
}
interface ChatRequestRef {
  id: string;
  publicId: string;
  province: string;
  city: string | null;
  status: string;
  mortgageCategory: string;
  productTypes: string[];
}

/** GET /api/conversations list item (last message + unread count). */
export interface ConversationListItem {
  id: string;
  publicId: string;
  status: "ACTIVE" | "CLOSED";
  updatedAt: string;
  messages: { body: string; createdAt: string; senderId: string }[];
  broker: ChatBroker;
  borrower: ChatParty;
  request: ChatRequestRef;
  unreadCount: number;
}

/** GET /api/conversations/:id — the full thread (messages oldest→newest). */
export interface ConversationThread {
  id: string;
  publicId: string;
  status: "ACTIVE" | "CLOSED";
  requestId: string;
  borrowerId: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  broker: ChatBroker;
  borrower: ChatParty;
  request: ChatRequestRef & { desiredTimeline: string | null; notes: string | null };
  hasMore: boolean;
}

export async function getConversations(token: string) {
  return api<ConversationListItem[]>("/api/conversations", { token });
}

export async function getConversation(token: string, id: string) {
  return api<ConversationThread>(`/api/conversations/${id}`, { token });
}

/** POST /api/messages → the created message. Errors carry code (turn/entitlement limits). */
export async function sendMessage(token: string, conversationId: string, body: string) {
  return api<ChatMessage>("/api/messages", {
    method: "POST",
    token,
    body: { conversationId, body },
  });
}

export async function closeConversation(token: string, id: string) {
  return api<ConversationThread>(`/api/conversations/${id}`, {
    method: "PUT",
    token,
    body: { status: "CLOSED" },
  });
}

// ── Trust & safety (App Store 1.2: report + block) ───────────────────────────
/** POST /api/reports — flag content. 409 = already reported, 429 = daily cap. */
export async function reportTarget(token: string, targetType: string, targetId: string, reason: string) {
  return api("/api/reports", { method: "POST", token, body: { targetType, targetId, reason } });
}

/** POST /api/users/:publicId/block — block a user (symmetric; idempotent). */
export async function blockUser(token: string, publicId: string) {
  return api<{ success: boolean; blocked: boolean }>(`/api/users/${publicId}/block`, {
    method: "POST",
    token,
  });
}

// ── Push notifications ───────────────────────────────────────────────────────
export interface DeviceRegistration {
  token: string; // Expo push token
  platform: "IOS" | "ANDROID";
  locale?: string;
  deviceName?: string;
  appVersion?: string;
}

/** POST /api/notifications/register-device (204). 409 = token owned by another account. */
export async function registerDevice(sessionToken: string, reg: DeviceRegistration) {
  return api("/api/notifications/register-device", { method: "POST", token: sessionToken, body: reg });
}

/** DELETE /api/notifications/register-device — unregister this device's push token. */
export async function unregisterDevice(sessionToken: string, pushToken: string) {
  return api("/api/notifications/register-device", {
    method: "DELETE",
    token: sessionToken,
    body: { token: pushToken },
  });
}

// ── Admin (moderation) ───────────────────────────────────────────────────────
export interface AdminQueue {
  pendingBrokers: {
    id: string;
    publicId: string;
    brokerageName: string;
    province: string;
    subscriptionTier: string;
    createdAt: string;
    user: { publicId: string; name: string | null; email: string };
  }[];
  openReports: {
    id: string;
    publicId: string;
    reason: string;
    targetType: string;
    targetId: string;
    status: string;
    createdAt: string;
    reporter: { id: string; name: string | null; email: string } | null;
  }[];
  pendingRequests: {
    id: string;
    publicId: string;
    status: string;
    mortgageCategory: string;
    productTypes: string[];
    province: string;
    city: string | null;
    createdAt: string;
    borrower: { id: string; name: string | null; email: string };
  }[];
  counts: { pendingBrokers: number; openReports: number; pendingRequests: number; total: number };
}

export interface AdminUser {
  id: string;
  publicId: string;
  email: string;
  name: string | null;
  role: "BORROWER" | "BROKER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  createdAt: string;
  broker: { verificationStatus: string; subscriptionTier: string; brokerageName: string } | null;
  _count: { borrowerRequests: number; conversations: number };
}

export async function getAdminQueue(token: string) {
  return api<AdminQueue>("/api/admin/queue", { token });
}

export async function moderateRequest(token: string, id: string, status: string, reason?: string) {
  return api(`/api/admin/requests/${id}`, { method: "PUT", token, body: { status, ...(reason ? { reason } : {}) } });
}

/** Returns { status: "PENDING_SECOND_REVIEW" } (202) under the two-admin gate. */
export async function moderateBroker(token: string, id: string, verificationStatus: string, reason?: string) {
  return api<{ status?: string; message?: string; verificationStatus?: string }>(
    `/api/admin/brokers/${id}`,
    { method: "PUT", token, body: { verificationStatus, ...(reason ? { reason } : {}) } },
  );
}

export async function moderateReport(token: string, id: string, status: string, adminNotes?: string) {
  return api(`/api/admin/reports/${id}`, { method: "PUT", token, body: { status, ...(adminNotes ? { adminNotes } : {}) } });
}

export async function getAdminUsers(
  token: string,
  opts: { search?: string; role?: string; status?: string; page?: number } = {},
) {
  const p = new URLSearchParams();
  if (opts.search) p.set("search", opts.search);
  if (opts.role) p.set("role", opts.role);
  if (opts.status) p.set("status", opts.status);
  if (opts.page) p.set("page", String(opts.page));
  const qs = p.toString();
  return api<{ data: AdminUser[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
    `/api/admin/users${qs ? `?${qs}` : ""}`,
    { token },
  );
}

export async function moderateUser(token: string, id: string, status: string, reason?: string) {
  return api<{ id: string; status: string }>(`/api/admin/users/${id}`, {
    method: "PUT",
    token,
    body: { status, ...(reason ? { reason } : {}) },
  });
}

// Admin — user detail
export interface AdminConvItem {
  id: string;
  publicId: string;
  status: string;
  updatedAt: string;
  _count: { messages: number };
  broker: { id: string; user: { name: string | null; email: string } } | null;
  borrower: { id: string; name: string | null; email: string } | null;
  request: { id: string; province: string; mortgageCategory: string } | null;
}
export interface AdminReqItem {
  id: string;
  publicId: string;
  province: string;
  city: string | null;
  status: string;
  mortgageCategory: string;
  createdAt: string;
}
export interface AdminUserDetail {
  id: string;
  publicId: string;
  email: string;
  name: string | null;
  role: "BORROWER" | "BROKER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  emailVerified: string | null;
  createdAt: string;
  broker: {
    id: string;
    brokerageName: string;
    province: string;
    phone: string | null;
    licenseNumber: string | null;
    bio: string | null;
    yearsExperience: number | null;
    verificationStatus: string;
    subscriptionTier: string;
    responseCredits: number;
    profilePhoto: string | null;
    areasServed: string | null;
    specialties: string | null;
    updatedAt: string;
    _count: { conversations: number };
    conversations: AdminConvItem[];
  } | null;
  borrowerRequests: AdminReqItem[];
  conversations: AdminConvItem[];
  _count: { borrowerRequests: number; conversations: number; reports: number };
}
export async function getAdminUser(token: string, id: string) {
  return api<AdminUserDetail>(`/api/admin/users/${id}`, { token });
}
export async function sendAdminNotice(token: string, userId: string, subject: string, body: string) {
  return api("/api/admin/notices", { method: "POST", token, body: { userId, subject, body } });
}

// Admin — requests moderation
export interface AdminRequestListItem extends BorrowerRequest {
  borrower: { id: string; name: string | null; email: string; status: string };
}
export async function getAdminRequests(
  token: string,
  opts: { search?: string; status?: string; type?: string; page?: number } = {},
) {
  const p = new URLSearchParams();
  if (opts.search) p.set("search", opts.search);
  if (opts.status) p.set("status", opts.status);
  if (opts.type) p.set("type", opts.type);
  if (opts.page) p.set("page", String(opts.page));
  const qs = p.toString();
  return api<{ data: AdminRequestListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
    `/api/admin/requests${qs ? `?${qs}` : ""}`,
    { token },
  );
}
export async function getAdminRequest(token: string, id: string) {
  return api<AdminRequestListItem & { conversations: ConversationSummary[] }>(`/api/admin/requests/${id}`, { token });
}
export async function moderateAdminRequest(token: string, id: string, status: string, reason?: string) {
  return api(`/api/admin/requests/${id}`, { method: "PUT", token, body: { status, ...(reason ? { reason } : {}) } });
}
export async function deleteAdminRequest(token: string, id: string, reason?: string) {
  return api<{ success: boolean }>(`/api/admin/requests/${id}`, {
    method: "DELETE",
    token,
    body: reason ? { reason } : {},
  });
}

// Admin — reports
export interface AdminReport {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  adminNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  reporter: { id: string; name: string | null; email: string } | null;
}
export async function getAdminReports(
  token: string,
  opts: { search?: string; status?: string; targetType?: string; page?: number } = {},
) {
  const p = new URLSearchParams();
  if (opts.search) p.set("search", opts.search);
  if (opts.status) p.set("status", opts.status);
  if (opts.targetType) p.set("targetType", opts.targetType);
  if (opts.page) p.set("page", String(opts.page));
  const qs = p.toString();
  return api<{ data: AdminReport[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
    `/api/admin/reports${qs ? `?${qs}` : ""}`,
    { token },
  );
}
export async function getAdminReport(token: string, id: string) {
  return api<AdminReport & { targetDetails: Record<string, unknown> | null }>(`/api/admin/reports/${id}`, { token });
}
export async function getAdminReportSummary(token: string) {
  return api<{ OPEN: number; REVIEWED: number; RESOLVED: number; DISMISSED: number }>(
    "/api/admin/reports/summary",
    { token },
  );
}
export async function moderateAdminReport(token: string, id: string, body: { status?: string; adminNotes?: string }) {
  return api(`/api/admin/reports/${id}`, { method: "PUT", token, body });
}

// Admin — conversations (chat history moderation)
export interface AdminConversationListItem {
  id: string;
  publicId: string;
  status: string;
  updatedAt: string;
  borrower: { id: string; name: string | null; email: string; status: string };
  broker: { id: string; brokerageName: string; user: { id: string; name: string | null; email: string; status: string } };
  request: { id: string; province: string; city: string | null; status: string; mortgageCategory: string };
  _count: { messages: number };
  messages: { body: string; createdAt: string; sender: { name: string | null } }[];
}
export interface AdminConversationThread {
  id: string;
  publicId: string;
  status: string;
  borrower: { id: string; name: string | null };
  broker: { brokerageName: string; user: { name: string | null } };
  messages: (ChatMessage & { sender: { id: string; name: string | null; email: string; role: string } })[];
  nextCursor: string | null;
  hasMore: boolean;
}
export async function getAdminConversations(
  token: string,
  opts: { search?: string; status?: string; page?: number } = {},
) {
  const p = new URLSearchParams();
  if (opts.search) p.set("search", opts.search);
  if (opts.status) p.set("status", opts.status);
  if (opts.page) p.set("page", String(opts.page));
  const qs = p.toString();
  return api<{ data: AdminConversationListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
    `/api/admin/conversations${qs ? `?${qs}` : ""}`,
    { token },
  );
}
export async function getAdminConversation(token: string, id: string, before?: string) {
  const qs = before ? `?messagesBefore=${before}` : "";
  return api<AdminConversationThread>(`/api/admin/conversations/${id}${qs}`, { token });
}
export async function closeAdminConversation(token: string, id: string, reason?: string) {
  return api(`/api/admin/conversations/${id}`, {
    method: "PUT",
    token,
    body: { status: "CLOSED", ...(reason ? { reason } : {}) },
  });
}

// Admin — stats
export interface AdminStats {
  users: number;
  totalBorrowers: number;
  totalBrokers: number;
  pendingVerifications: number;
  verifiedBrokers: number;
  requestsByStatus: {
    pendingApproval: number;
    open: number;
    inProgress: number;
    closed: number;
    expired: number;
    rejected: number;
    total: number;
  };
  activeConversations: number;
  openReports: number;
}
export async function getAdminStats(token: string) {
  return api<AdminStats>("/api/admin/stats", { token });
}

/** POST /api/auth/mobile-oauth → { sessionToken, user }. */
export async function loginWithOAuth(
  provider: "google" | "apple",
  idToken: string,
  name?: string | null,
) {
  return api<{ sessionToken: string; user: import("@/auth/session").SessionUser }>(
    "/api/auth/mobile-oauth",
    { method: "POST", body: { provider, idToken, name } },
  );
}
