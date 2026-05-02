import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Pagination helpers and a Prisma `where` builder shared by admin list endpoints.
 *
 * Semantics are held to match the existing hand-rolled logic in
 * `pages/api/admin/users/index.ts`, `brokers/index.ts`, `requests/index.ts`,
 * `reports/index.ts`, and `conversations/index.ts` so adopting these helpers
 * in those files is a no-op change in behavior.
 */

/**
 * Reads `page` and `limit` from `req.query` and returns normalized values
 * plus the Prisma `skip` offset.
 *
 *   page  = max(1, parseInt(req.query.page) || 1)
 *   limit = min(100, max(1, parseInt(req.query.limit) || 20))
 *   skip  = (page - 1) * limit
 *
 * This matches `pages/api/admin/users/index.ts` lines 21-25 exactly.
 */
export function parsePagination(req: NextApiRequest): {
  page: number;
  limit: number;
  skip: number;
} {
  const pageStr = req.query.page;
  const limitStr = req.query.limit;

  const page = Math.max(1, parseInt(pageStr as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr as string) || 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Convert a dot-path string like `"broker.user.name"` into the nested Prisma
 * filter object that dot path represents, with `leaf` placed at the deepest
 * level.
 *
 * Example: buildNested("broker.user.name", { contains: "x" })
 *   => { broker: { user: { name: { contains: "x" } } } }
 */
function buildNested(path: string, leaf: unknown): Record<string, unknown> {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return {};
  let node: unknown = leaf;
  for (let i = parts.length - 1; i >= 0; i--) {
    node = { [parts[i]]: node };
  }
  return node as Record<string, unknown>;
}

export interface BuildSearchWhereParams {
  /** Raw value from `req.query.search`. Non-strings and empties are ignored. */
  search?: unknown;
  /**
   * Field paths to OR across when `search` is present. Supports dot paths for
   * relations, e.g. `"borrower.name"` or `"broker.user.email"`. All entries
   * are matched with `{ contains, mode: "insensitive" }`.
   */
  searchFields?: string[];
  /**
   * Flat top-level filter map. For each `[key, value]`:
   *   - `undefined`, `null`, empty string, or the literal `"ALL"` are skipped.
   *   - Everything else is assigned directly to `where[key] = value` (kept
   *     flat; this matches how every existing admin route sets things like
   *     `where.status = status` / `where.verificationStatus = status`).
   */
  filters?: Record<string, unknown>;
  /**
   * Per-filter-key allowlist of accepted string values. Use this for any
   * field that maps to a Prisma enum (`status`, `role`, `mortgageCategory`,
   * etc.) so users can't smuggle Prisma operators through `req.query`
   * (e.g. `?status[gte]=`). Filter values that aren't strings or aren't
   * in the allowlist are silently dropped.
   */
  enums?: Record<string, readonly string[]>;
  /**
   * Optional field name (e.g. `"publicId"` or `"targetId"`) to add to the
   * search OR clause as `{ contains: s }` with NO insensitive mode — matching
   * the existing code's treatment of id-like fields.
   */
  publicIdField?: string;
}

/**
 * Build a Prisma `where` object shared by all admin list endpoints.
 *
 * This intentionally keeps filters flat (top-level key → value assignment)
 * because every existing admin route does the same. If you need a nested
 * filter, add it to `where` yourself after calling this helper.
 *
 * Search behavior (only when `search` is a non-empty trimmed string):
 *   - For each entry in `searchFields`, add one `{ <dot-path>: { contains: s, mode: "insensitive" } }`
 *     clause to `where.OR`.
 *   - If `publicIdField` is provided, additionally add
 *     `{ [publicIdField]: { contains: s } }` (no insensitive mode).
 *   - OR is omitted entirely when there are no produced clauses.
 *
 * Returned type is generic so callers can pin it to their Prisma model's
 * `WhereInput` if desired, but internally we treat it as
 * `Record<string, unknown>` because constructing a properly-typed `WhereInput`
 * across every model would require importing Prisma types here.
 */
export function buildSearchWhere<T extends Record<string, unknown>>(
  params: BuildSearchWhereParams
): T {
  const { search, searchFields, filters, enums, publicIdField } = params;
  const where: Record<string, unknown> = {};

  // Flat filter assignment. "ALL" and empty strings are skipped, matching
  // the existing `if (status && status !== "ALL")` pattern in every admin route.
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue;
      if (typeof value === "string" && (value === "" || value === "ALL")) continue;
      // Enum allowlist gate. Anything non-string or outside the allowed set
      // is dropped silently — defends against `?status[gte]=` style smuggling
      // (qs/query parsers can yield objects) and rogue values that would
      // otherwise reach Prisma as raw filter operators.
      if (enums && key in enums) {
        if (typeof value !== "string" || !enums[key].includes(value)) continue;
      }
      where[key] = value;
    }
  }

  // Search OR-clause builder.
  if (typeof search === "string") {
    const s = search.trim();
    if (s.length > 0) {
      const orClauses: Record<string, unknown>[] = [];

      if (searchFields && searchFields.length > 0) {
        for (const field of searchFields) {
          if (!field) continue;
          if (field.includes(".")) {
            orClauses.push(buildNested(field, { contains: s, mode: "insensitive" }));
          } else {
            orClauses.push({ [field]: { contains: s, mode: "insensitive" } });
          }
        }
      }

      if (publicIdField) {
        orClauses.push({ [publicIdField]: { contains: s } });
      }

      if (orClauses.length > 0) {
        where.OR = orClauses;
      }
    }
  }

  return where as T;
}

/**
 * Write a standard paginated JSON response:
 *
 *   { data, pagination: { page, limit, total, totalPages } }
 *
 * Returns the NextApiResponse so callers can `return paginatedResponse(...)`.
 */
export function paginatedResponse<T>(
  res: NextApiResponse,
  data: T[],
  pagination: { page: number; limit: number; total: number }
): NextApiResponse {
  const { page, limit, total } = pagination;
  return res.status(200).json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }) as unknown as NextApiResponse;
}
