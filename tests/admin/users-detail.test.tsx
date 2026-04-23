import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

vi.mock("@/components/admin/AdminShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    query: { id: "123456789" },
    pathname: "/admin/users/[id]",
    locale: "ko",
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

interface UserFixture {
  id: string;
  publicId: string;
  email: string;
  name: string | null;
  role: "BORROWER" | "BROKER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  emailVerified: string | null;
  createdAt: string;
  updatedAt: string;
  broker: null | {
    id: string;
    brokerageName: string;
    province: string;
    licenseNumber: string;
    phone: string | null;
    mortgageCategory: string;
    bio: string | null;
    yearsExperience: number | null;
    verificationStatus: string;
    subscriptionTier: string;
    responseCredits: number;
  };
  borrowerRequests: Array<{
    id: string;
    publicId: string;
    province: string;
    city: string | null;
    status: string;
    mortgageCategory: string;
    createdAt: string;
    updatedAt: string;
  }>;
  conversations: Array<{
    id: string;
    publicId: string;
    status: string;
    updatedAt: string;
    _count: { messages: number };
    broker: { id: string; user: { name: string; email: string } };
    borrower: { id: string; name: string; email: string };
    request: { id: string; province: string; mortgageCategory: string };
  }>;
  _count: { borrowerRequests: number; conversations: number; reports: number };
}

const USER_FIXTURE: UserFixture = {
  id: "usr_1",
  publicId: "123456789",
  email: "bob@example.com",
  name: "Bob Borrower",
  role: "BORROWER",
  status: "ACTIVE",
  emailVerified: "2025-01-01T00:00:00.000Z",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-02T00:00:00.000Z",
  broker: null,
  borrowerRequests: [
    {
      id: "req_1",
      publicId: "100000001",
      province: "ON",
      city: "Toronto",
      status: "OPEN",
      mortgageCategory: "RESIDENTIAL",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    },
  ],
  conversations: [
    {
      id: "conv_1",
      publicId: "CONV-001",
      status: "ACTIVE",
      updatedAt: "2025-01-02T00:00:00.000Z",
      _count: { messages: 5 },
      broker: { id: "broker_1", user: { name: "Jane Broker", email: "jane@example.com" } },
      borrower: { id: "usr_1", name: "Bob Borrower", email: "bob@example.com" },
      request: { id: "req_1", province: "ON", mortgageCategory: "RESIDENTIAL" },
    },
  ],
  _count: {
    borrowerRequests: 1,
    conversations: 1,
    reports: 0,
  },
};

import AdminUserDetailPage from "@/pages/admin/users/[id]";

function mockFetchWith(user: UserFixture) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/admin/users/") && (!init?.method || init.method === "GET")) {
      return new Response(JSON.stringify(user), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("/admin/users/[id]", () => {
  beforeEach(() => {
    mockInvalidate.mockClear();
    mockToast.mockClear();
  });

  it("renders name, public id, role + status badges", async () => {
    mockFetchWith(USER_FIXTURE);
    render(<AdminUserDetailPage />);
    expect(await screen.findByText("Bob Borrower")).toBeInTheDocument();
    expect(screen.getAllByText("BORROWER").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ACTIVE").length).toBeGreaterThan(0);
  });

  it("back link points to /admin/people (no legacy /admin/users)", async () => {
    mockFetchWith(USER_FIXTURE);
    render(<AdminUserDetailPage />);
    const link = (await screen.findByTestId("user-back-link")) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/admin/people");
  });

  it("has no legacy design-system classes", async () => {
    mockFetchWith(USER_FIXTURE);
    const { container } = render(<AdminUserDetailPage />);
    await screen.findByText("Bob Borrower");
    const html = container.innerHTML;
    expect(html).not.toMatch(/\brounded-full\b/);
    expect(html).not.toMatch(/\brounded-(xl|2xl|lg|md)\b/);
    expect(html).not.toMatch(/\bcard-elevated\b/);
    expect(html).not.toMatch(/\bstagger-/);
    expect(html).not.toMatch(/bg-rose-\d/);
    expect(html).not.toMatch(/animate-fade/);
  });

  it("request rows link to /admin/activity?req=<publicId>", async () => {
    mockFetchWith(USER_FIXTURE);
    render(<AdminUserDetailPage />);
    const row = (await screen.findByTestId("user-request-row")) as HTMLAnchorElement;
    expect(row.getAttribute("href")).toBe("/admin/activity?req=100000001");
  });

  it("conversation rows link to /admin/activity?id=<cuid>", async () => {
    mockFetchWith(USER_FIXTURE);
    render(<AdminUserDetailPage />);
    const row = (await screen.findByTestId("user-conversation-row")) as HTMLAnchorElement;
    expect(row.getAttribute("href")).toBe("/admin/activity?id=conv_1");
  });

  it("clicking 정지 opens danger-tone confirm dialog", async () => {
    mockFetchWith(USER_FIXTURE);
    render(<AdminUserDetailPage />);
    await userEvent.click(await screen.findByTestId("user-suspend"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("계정 정지")).toBeInTheDocument();
    expect(dialog.querySelector("button.bg-error-700")).not.toBeNull();
  });

  it("confirming 정지 PUTs {status: 'SUSPENDED'}", async () => {
    const fetchMock = mockFetchWith(USER_FIXTURE);
    render(<AdminUserDetailPage />);
    await userEvent.click(await screen.findByTestId("user-suspend"));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "정지" }));

    await waitFor(() => {
      const puts = fetchMock.mock.calls.filter(
        (c) => c[1]?.method === "PUT" && String(c[0]).includes("/api/admin/users/"),
      );
      expect(puts).toHaveLength(1);
      const init = puts[0][1] as RequestInit;
      expect(JSON.parse(init.body as string)).toEqual({ status: "SUSPENDED" });
    });
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it("SUSPENDED account shows only 재활성화, not suspend/ban", async () => {
    mockFetchWith({ ...USER_FIXTURE, status: "SUSPENDED" });
    render(<AdminUserDetailPage />);
    expect(await screen.findByTestId("user-reactivate")).toBeInTheDocument();
    expect(screen.queryByTestId("user-suspend")).not.toBeInTheDocument();
    expect(screen.queryByTestId("user-ban")).not.toBeInTheDocument();
  });

  it("ADMIN user shows no status-change buttons (admin-note visible)", async () => {
    mockFetchWith({ ...USER_FIXTURE, role: "ADMIN" });
    render(<AdminUserDetailPage />);
    await screen.findByText("Bob Borrower");
    expect(screen.queryByTestId("user-suspend")).not.toBeInTheDocument();
    expect(screen.queryByTestId("user-ban")).not.toBeInTheDocument();
    expect(screen.queryByTestId("user-reactivate")).not.toBeInTheDocument();
    expect(
      screen.getByText(/관리자 계정은 상태를 변경할 수 없습니다/),
    ).toBeInTheDocument();
  });

  it("renders BROKER details section when user has a broker record", async () => {
    mockFetchWith({
      ...USER_FIXTURE,
      role: "BROKER",
      broker: {
        id: "broker_1",
        brokerageName: "Acme Mortgage",
        province: "ON",
        licenseNumber: "LIC-001",
        phone: null,
        mortgageCategory: "RESIDENTIAL",
        bio: null,
        yearsExperience: 3,
        verificationStatus: "VERIFIED",
        subscriptionTier: "PRO",
        responseCredits: 10,
      },
    });
    render(<AdminUserDetailPage />);
    expect(await screen.findByText("Acme Mortgage")).toBeInTheDocument();
    expect(screen.getByText("VERIFIED")).toBeInTheDocument();
    expect(screen.getByText("PRO")).toBeInTheDocument();
    // credits stat box
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("fetch failure renders error branch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "No" }), { status: 404 })),
    );
    render(<AdminUserDetailPage />);
    expect(await screen.findByText("사용자를 불러올 수 없습니다")).toBeInTheDocument();
  });
});
