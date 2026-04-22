import { createMocks, RequestMethod } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

export interface MakeReqOptions {
  method?: RequestMethod;
  body?: unknown;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
  url?: string;
}

/**
 * Returns `{ req, res }` typed as Next.js's API handler signature so handlers
 * can be invoked directly in tests. Compatible with `node-mocks-http`'s
 * chainable response helpers (`res._getJSONData()`, `res.statusCode`, etc).
 */
export function makeReqRes(opts: MakeReqOptions = {}) {
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
    method: opts.method ?? "GET",
    body: opts.body,
    query: opts.query,
    headers: opts.headers ?? {},
    url: opts.url,
  });
  return { req, res };
}

export function jsonBody<T = unknown>(res: ReturnType<typeof makeReqRes>["res"]): T {
  return res._getJSONData() as T;
}
