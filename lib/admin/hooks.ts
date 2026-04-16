"use client"; // not needed in pages router but harmless

import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/components/Toast";

/**
 * Debounce any value. Returns the latest `value` after it has been stable
 * for `delayMs` milliseconds. Cleans up on unmount / value change.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}

export interface UseAdminMutationOptions<TResult> {
  /** Toast shown on success. If a function, it is called with the result. */
  successMessage?: string | ((r: TResult) => string);
  /** Toast shown on error. If a function, it is called with the thrown error. */
  errorMessage?: string | ((e: unknown) => string);
  /** Side effect after a successful call. */
  onSuccess?: (r: TResult) => void;
}

/**
 * Wrap an async action with loading state + toast feedback.
 *
 * The returned `mutate` never throws; on failure it toasts and resolves to
 * `null`, so callers can branch on `if (!result) return` without a try/catch.
 */
export function useAdminMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  opts: UseAdminMutationOptions<TResult> = {}
): {
  mutate: (...args: TArgs) => Promise<TResult | null>;
  loading: boolean;
} {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Keep the latest fn / opts in refs so `mutate`'s identity is stable.
  const fnRef = useRef(fn);
  const optsRef = useRef(opts);
  useEffect(() => {
    fnRef.current = fn;
    optsRef.current = opts;
  });

  const mutate = useCallback(async (...args: TArgs): Promise<TResult | null> => {
    setLoading(true);
    try {
      const result = await fnRef.current(...args);
      const o = optsRef.current;
      if (o.successMessage !== undefined) {
        const msg = typeof o.successMessage === "function" ? o.successMessage(result) : o.successMessage;
        if (msg) toast(msg, "success");
      }
      if (o.onSuccess) o.onSuccess(result);
      return result;
    } catch (err) {
      const o = optsRef.current;
      let msg: string;
      if (typeof o.errorMessage === "function") {
        msg = o.errorMessage(err);
      } else if (typeof o.errorMessage === "string") {
        msg = o.errorMessage;
      } else {
        msg = "Something went wrong";
      }
      toast(msg, "error");
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return { mutate, loading };
}

export interface UseAdminListResult<T> {
  data: T[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  page: number;
  setPage: (p: number) => void;
}

/**
 * Hook for admin list pages. Given an `endpoint` and a param bag, fetches:
 *
 *   `${endpoint}?${params}&page=${page}&limit=20`
 *
 * Expected server shape: `{ data: T[], pagination: { total: number } }`
 * (matches the current output of every `pages/api/admin/.../index.ts`).
 *
 * Behavior:
 *   - Whenever `params` changes (compared via `JSON.stringify`), `page` is
 *     auto-reset to 1.
 *   - `page` changes trigger a refetch.
 *   - `refetch()` re-runs the current request without touching `page`.
 *   - Stale responses are dropped via an incrementing request-id ref, so
 *     rapid filter changes never clobber the UI with an out-of-order result.
 *   - Undefined/empty-string values in `params` are stripped from the URL.
 */
export function useAdminList<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>
): UseAdminListResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [refetchKey, setRefetchKey] = useState(0);

  // Stable string so effects don't re-run on object-identity-only changes.
  const paramsKey = JSON.stringify(params);

  // Reset page to 1 whenever the filter set changes.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  // Monotonic request counter so older in-flight fetches can be discarded.
  const reqIdRef = useRef(0);

  useEffect(() => {
    const myId = ++reqIdRef.current;

    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      if (typeof v === "string" && v === "") continue;
      qs.set(k, String(v));
    }
    qs.set("page", String(page));
    qs.set("limit", "20");

    setLoading(true);
    setError(null);

    fetch(`${endpoint}?${qs.toString()}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || `Request failed: ${res.status}`);
        }
        return res.json() as Promise<{ data: T[]; pagination: { total: number } }>;
      })
      .then((body) => {
        if (reqIdRef.current !== myId) return; // stale response, discard
        setData(body.data ?? []);
        setTotal(body.pagination?.total ?? 0);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (reqIdRef.current !== myId) return;
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, paramsKey, page, refetchKey]);

  const refetch = useCallback(() => setRefetchKey((k) => k + 1), []);

  return { data, total, loading, error, refetch, page, setPage };
}
