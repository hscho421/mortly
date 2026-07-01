import { API_URL, SESSION_COOKIE_NAME } from "@/config";

/**
 * Typed API client for the existing Next.js backend (pages/api/*).
 *
 * Auth: the app's minted next-auth JWT is sent as the session COOKIE, so every
 * existing endpoint authenticates it via getServerSession unchanged. (React
 * Native fetch — unlike a browser — allows setting the Cookie header.)
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
  if (opts.token) headers["Cookie"] = `${SESSION_COOKIE_NAME}=${opts.token}`;

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
