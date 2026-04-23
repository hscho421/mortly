import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Module mocks (must be hoisted before the page import) ──────────────

const mockInvalidate = vi.fn();
vi.mock("@/lib/admin/AdminDataContext", () => ({
  useAdminData: () => ({
    badges: { pendingVerifications: 0, pendingRequests: 0, openReports: 0, inbox: 0 },
    inboxRows: [],
    badgesLoaded: true,
    inboxLoaded: true,
    error: null,
    invalidate: mockInvalidate,
  }),
}));

const mockToast = vi.fn();
vi.mock("@/components/Toast", () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// AdminShell renders its chrome only when session is an ADMIN; we stub it out
// so the test focuses on the page body and its action dispatch, not the shell.
vi.mock("@/components/admin/AdminShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}));

// next/router: supply an `id` query param pointing at the broker we mock below.
vi.mock("next/router", () => {
  const push = vi.fn();
  const replace = vi.fn();
  return {
    useRouter: () => ({
      query: { id: "brk_abc123" },
      pathname: "/admin/brokers/[id]",
      locale: "ko",
      push,
      replace,
    }),
  };
});

// ── Fixture ────────────────────────────────────────────────────────────

interface BrokerFixture {
  id: string;
  brokerageName: string;
  province: string;
  licenseNumber: string;
  phone: string | null;
  mortgageCategory: string;
  bio: string | null;
  yearsExperience: number | null;
  areasServed: string | null;
  specialties: string | null;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  subscriptionTier: string;
  responseCredits: number;
  createdAt: string;
  user: {
    id: string;
    publicId: string;
    name: string | null;
    email: string;
    status: "ACTIVE" | "SUSPENDED" | "BANNED";
    createdAt: string;
  };
  conversations: Array<{
    id: string;
    status: string;
    updatedAt: string;
    borrower: { id: string; name: string | null; email: string };
    request: { id: string; province: string; mortgageCategory?: string | null };
    _count: { messages: number };
  }>;
  _count: { conversations: number };
}

const BROKER_FIXTURE: BrokerFixture = {
  id: "brk_abc123",
  brokerageName: "Acme Mortgage",
  province: "ON",
  licenseNumber: "LIC-001",
  phone: null,
  mortgageCategory: "RESIDENTIAL",
  bio: null,
  yearsExperience: 5,
  areasServed: null,
  specialties: null,
  verificationStatus: "PENDING",
  subscriptionTier: "FREE",
  responseCredits: 3,
  createdAt: "2025-01-01T00:00:00.000Z",
  user: {
    id: "usr_xyz789",
    publicId: "123456789",
    name: "Jane Broker",
    email: "jane@example.com",
    status: "ACTIVE",
    createdAt: "2025-01-01T00:00:00.000Z",
  },
  conversations: [],
  _count: { conversations: 0 },
};

import AdminBrokerDetailPage from "@/pages/admin/brokers/[id]";

// ── Test helpers ───────────────────────────────────────────────────────

type FetchMock = ReturnType<typeof vi.fn>;

function mockFetchWithBroker(overrides: Partial<BrokerFixture> = {}): FetchMock {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/admin/brokers/") && (!init || init.method === undefined || init.method === "GET")) {
      return new Response(JSON.stringify({ ...BROKER_FIXTURE, ...overrides }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("/admin/brokers/[id]", () => {
  beforeEach(() => {
    mockInvalidate.mockClear();
    mockToast.mockClear();
  });

  it("renders broker name, brokerage, and PENDING verification badge", async () => {
    mockFetchWithBroker();
    render(<AdminBrokerDetailPage />);
    expect(await screen.findByText("Jane Broker")).toBeInTheDocument();
    expect(screen.getByText("Acme Mortgage")).toBeInTheDocument();
    expect(screen.getByText("PENDING")).toBeInTheDocument();
  });

  it("back link points to /admin/people?role=BROKER", async () => {
    mockFetchWithBroker();
    render(<AdminBrokerDetailPage />);
    const link = (await screen.findByTestId("broker-back-link")) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toMatch(/\/admin\/people\?role=BROKER/);
  });

  it("has no legacy design-system classes (rounded-full, rose-*, card-elevated, stagger-*)", async () => {
    mockFetchWithBroker();
    const { container } = render(<AdminBrokerDetailPage />);
    await screen.findByText("Jane Broker");
    const html = container.innerHTML;
    expect(html).not.toMatch(/\brounded-full\b/);
    expect(html).not.toMatch(/\brounded-(xl|2xl|lg|md)\b/);
    expect(html).not.toMatch(/\bcard-elevated\b/);
    expect(html).not.toMatch(/\bstagger-/);
    expect(html).not.toMatch(/bg-rose-\d/);
    expect(html).not.toMatch(/animate-fade/);
  });

  it("clicking 인증 opens the confirm dialog with verify copy", async () => {
    mockFetchWithBroker();
    render(<AdminBrokerDetailPage />);
    const verifyBtn = await screen.findByTestId("broker-verify");
    await userEvent.click(verifyBtn);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("전문가 인증")).toBeInTheDocument();
    // Body interpolates the broker name — scope to the dialog to avoid
    // matching the section-head title (which also contains "Jane Broker").
    expect(within(dialog).getByText(/Jane Broker/)).toBeInTheDocument();
  });

  it("confirming 인증 PUTs {verificationStatus: 'VERIFIED'} to /api/admin/brokers/:id and invalidates", async () => {
    const fetchMock = mockFetchWithBroker();
    render(<AdminBrokerDetailPage />);
    await userEvent.click(await screen.findByTestId("broker-verify"));
    // Both the page and the dialog have a button named "인증" — scope to the dialog.
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "인증" }));

    await waitFor(() => {
      const puts = fetchMock.mock.calls.filter(
        (c) => c[1]?.method === "PUT" && String(c[0]).includes("/api/admin/brokers/"),
      );
      expect(puts).toHaveLength(1);
      const init = puts[0][1] as RequestInit;
      const body = JSON.parse(init.body as string);
      expect(body).toEqual({ verificationStatus: "VERIFIED" });
    });
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(expect.any(String), "success");
  });

  it("반려 (reject) opens dialog in danger tone", async () => {
    mockFetchWithBroker();
    render(<AdminBrokerDetailPage />);
    await userEvent.click(await screen.findByTestId("broker-reject"));
    const dialog = await screen.findByRole("dialog");
    const confirm = dialog.querySelector("button.bg-error-700");
    expect(confirm).not.toBeNull();
  });

  it("계정 정지 PUTs {status: 'SUSPENDED'} to /api/admin/users/:userId", async () => {
    const fetchMock = mockFetchWithBroker();
    render(<AdminBrokerDetailPage />);
    await userEvent.click(await screen.findByTestId("broker-suspend"));
    // After the dialog opens, the page still has a "정지" button too — scope
    // the confirm click to the dialog.
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "정지" }));

    await waitFor(() => {
      const puts = fetchMock.mock.calls.filter(
        (c) => c[1]?.method === "PUT" && String(c[0]).includes("/api/admin/users/"),
      );
      expect(puts).toHaveLength(1);
      const init = puts[0][1] as RequestInit;
      const body = JSON.parse(init.body as string);
      expect(body).toEqual({ status: "SUSPENDED" });
    });
  });

  it("shows 재활성화 only for non-ACTIVE accounts", async () => {
    mockFetchWithBroker({
      user: { ...BROKER_FIXTURE.user, status: "SUSPENDED" },
    });
    render(<AdminBrokerDetailPage />);
    expect(await screen.findByTestId("broker-reactivate")).toBeInTheDocument();
    expect(screen.queryByTestId("broker-suspend")).not.toBeInTheDocument();
    expect(screen.queryByTestId("broker-ban")).not.toBeInTheDocument();
  });

  it("renders the error branch when the broker fetch fails", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminBrokerDetailPage />);
    expect(await screen.findByText("전문가를 불러올 수 없습니다")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("toasts error and does not invalidate on mutation failure", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/admin/brokers/") && (!init?.method || init.method === "GET")) {
        return new Response(JSON.stringify(BROKER_FIXTURE), { status: 200 });
      }
      // PUT fails
      return new Response(JSON.stringify({ error: "Nope" }), { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminBrokerDetailPage />);
    await userEvent.click(await screen.findByTestId("broker-verify"));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "인증" }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("Nope", "error");
    });
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
