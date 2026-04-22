import { beforeEach, vi } from "vitest";
import { mockDeep, mockReset, DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

/**
 * A reusable, typed deep-mock of PrismaClient.
 *
 * Tests import `prismaMock` and drive returns via `prismaMock.user.findUnique.mockResolvedValue(...)`.
 * The default export wired up in `@/lib/prisma` is replaced with this mock in `setupPrismaMock`.
 *
 * IMPORTANT: we also teach `$transaction` to behave like a real tx:
 *  - when passed an array → resolve each promise in order
 *  - when passed a callback → invoke the callback with the mock itself
 * This matches what the codebase expects (see pages/api/conversations/index.ts).
 */
export type PrismaMock = DeepMockProxy<PrismaClient>;

export const prismaMock: PrismaMock = mockDeep<PrismaClient>();

function wireTransaction(mock: PrismaMock) {
  // @ts-expect-error — replace generated mock with real-ish implementation
  mock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: PrismaClient) => unknown)(mock as unknown as PrismaClient);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return undefined;
  });
}

wireTransaction(prismaMock);

// Replace the singleton used by the app.
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/prisma.ts", () => ({ default: prismaMock }));

beforeEach(() => {
  mockReset(prismaMock);
  wireTransaction(prismaMock);
});
