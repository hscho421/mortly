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
 * NOTE: mutating endpoints (POST/PUT/DELETE) additionally enforce a same-origin
 * CSRF check on the web. Wiring those for mobile (a mobile-exempt path when a
 * valid session is present and no browser Origin exists) is a per-feature
 * follow-up; GET reads work today.
 */

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
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
  const headers: Record<string, string> = { Accept: "application/json" };
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
    throw new ApiError(typeof data.error === "string" ? data.error : "REQUEST_FAILED", res.status);
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
