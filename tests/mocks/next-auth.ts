import { vi } from "vitest";

export type TestSessionUser = {
  id: string;
  publicId: string;
  email: string;
  name: string | null;
  role: "BORROWER" | "BROKER" | "ADMIN";
};

export type TestSession = { user: TestSessionUser } | null;

const sessionRef: { current: TestSession } = { current: null };

export function setSession(session: TestSession) {
  sessionRef.current = session;
}

export function clearSession() {
  sessionRef.current = null;
}

// Mock `getServerSession` — every API route calls this.
vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(async () => sessionRef.current),
}));

export function borrowerSession(overrides: Partial<TestSessionUser> = {}): TestSession {
  return {
    user: {
      id: overrides.id ?? "user_borrower_1",
      publicId: overrides.publicId ?? "100000001",
      email: overrides.email ?? "borrower@test.com",
      name: overrides.name ?? "Bob Borrower",
      role: "BORROWER",
    },
  };
}

export function brokerSession(overrides: Partial<TestSessionUser> = {}): TestSession {
  return {
    user: {
      id: overrides.id ?? "user_broker_1",
      publicId: overrides.publicId ?? "200000001",
      email: overrides.email ?? "broker@test.com",
      name: overrides.name ?? "Brenda Broker",
      role: "BROKER",
    },
  };
}

export function adminSession(overrides: Partial<TestSessionUser> = {}): TestSession {
  return {
    user: {
      id: overrides.id ?? "user_admin_1",
      publicId: overrides.publicId ?? "900000001",
      email: overrides.email ?? "admin@test.com",
      name: overrides.name ?? "Alice Admin",
      role: "ADMIN",
    },
  };
}
