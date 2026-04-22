import { vi } from "vitest";

/**
 * Stripe mock — the app accesses Stripe via `getStripe()` in `@/lib/stripe`.
 * We mock the whole lib so the real `Stripe` class never instantiates.
 * Tests override individual methods via `stripeMock.<resource>.<method>.mockResolvedValue(...)`.
 */
export const stripeMock = {
  customers: {
    create: vi.fn(),
    retrieve: vi.fn(),
  },
  subscriptions: {
    retrieve: vi.fn(),
    update: vi.fn(),
  },
  checkout: {
    sessions: {
      create: vi.fn(),
    },
  },
  billingPortal: {
    sessions: {
      create: vi.fn(),
    },
  },
  invoices: {
    list: vi.fn(),
  },
  webhooks: {
    constructEvent: vi.fn(),
  },
};

vi.mock("@/lib/stripe", async () => {
  const actual = await vi.importActual<typeof import("@/lib/stripe")>("@/lib/stripe");
  return {
    ...actual,
    getStripe: () => stripeMock as unknown as ReturnType<typeof actual.getStripe>,
  };
});
