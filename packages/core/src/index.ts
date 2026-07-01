/**
 * @mortly/core — shared, platform-agnostic logic for the Mortly web + mobile
 * apps. Everything exported here MUST be free of server (Prisma/fs), DOM, Next,
 * and React-Native imports so it runs unchanged in both a Next.js server and a
 * React Native runtime.
 *
 * Consumers may import the barrel (`@mortly/core`) or a submodule directly
 * (`@mortly/core/tiers`). The web keeps thin re-export shims at `lib/*` so its
 * existing `@/lib/*` imports are undisturbed.
 */
export * from "./normalizeEmail";
export * from "./validate";
export * from "./constants";
export * from "./tiers";
export * from "./format";
export * from "./brokerEntitlement";
export * from "./requestConfig";
