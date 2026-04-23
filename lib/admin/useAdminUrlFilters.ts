import { useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import type { ParsedUrlQuery } from "querystring";

/**
 * URL-backed filter state for admin list pages.
 *
 * Before this hook, `people.tsx`, `activity.tsx`, and `reports.tsx` each
 * hand-rolled the same `patchQuery + parse query-string into typed filter`
 * scaffold (~30 LOC × 3, identical logic). Centralizing here kills the drift
 * risk and lets each page express its filter shape as a single `parse`
 * function.
 *
 * Usage:
 *   const { filters, patch } = useAdminUrlFilters((q) => ({
 *     role:   parseEnum(q.role, ["BORROWER", "BROKER", "ADMIN"], "ALL"),
 *     status: parseEnum(q.status, ["ACTIVE", "SUSPENDED", "BANNED"], "ALL"),
 *     q:      typeof q.q === "string" ? q.q : "",
 *   }));
 *   const setRole = (r: Role) => patch({ role: r === "ALL" ? null : r, page: null });
 *
 * `patch` accepts `null` to delete a key. Passing an undefined key leaves it
 * untouched. Navigation is shallow so list refetches aren't required.
 */
export function useAdminUrlFilters<F>(
  parse: (query: ParsedUrlQuery) => F,
): {
  filters: F;
  patch: (patch: Record<string, string | null>) => void;
} {
  const router = useRouter();

  const filters = useMemo(() => parse(router.query), [parse, router.query]);

  const patch = useCallback(
    (incoming: Record<string, string | null>) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(router.query)) {
        if (typeof v === "string") next[k] = v;
      }
      for (const [k, v] of Object.entries(incoming)) {
        if (v === null) delete next[k];
        else next[k] = v;
      }
      void router.replace(
        { pathname: router.pathname, query: next },
        undefined,
        { shallow: true, locale: router.locale },
      );
    },
    [router],
  );

  return { filters, patch };
}

/**
 * Strict enum parser. Returns `fallback` when the value is missing or not in
 * the allowed set. Keeps filter types narrow at the call site.
 */
export function parseEnum<T extends string, F extends string = T>(
  value: unknown,
  allowed: readonly T[],
  fallback: F,
): T | F {
  if (typeof value !== "string") return fallback;
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}
