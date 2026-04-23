import { useCallback, useEffect, useState } from "react";

/**
 * Small fetch helper for drawer panels. Produces a discriminated-union state
 * so callers render a real error branch instead of getting stuck on a
 * skeleton when the endpoint 404s or the network fails.
 */
export type DrawerState<T> =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; message: string; retry: () => void }
  | { state: "ready"; data: T };

export function useDrawerResource<T>(
  /** The resource identifier. null/undefined = idle. */
  key: string | null | undefined,
  /** Fetcher — receives the key, returns parsed data. Throws on failure. */
  fetcher: (key: string) => Promise<T>,
): [DrawerState<T>, { refresh: () => void; setData: (d: T) => void }] {
  const [state, setState] = useState<DrawerState<T>>({ state: "idle" });
  const [attempt, setAttempt] = useState(0);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);
  const setData = useCallback((d: T) => setState({ state: "ready", data: d }), []);

  useEffect(() => {
    if (!key) {
      setState({ state: "idle" });
      return;
    }
    let cancelled = false;
    setState({ state: "loading" });
    fetcher(key)
      .then((d) => {
        if (!cancelled) setState({ state: "ready", data: d });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load";
        setState({ state: "error", message: msg, retry: refresh });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return [state, { refresh, setData }];
}

/** Throws if !ok so useDrawerResource sees a rejected promise. */
export async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      (body && typeof body.error === "string" && body.error) ||
        `HTTP ${res.status}`,
    );
  }
  return (await res.json()) as T;
}
