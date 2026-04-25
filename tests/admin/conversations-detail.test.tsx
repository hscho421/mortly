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
    query: { id: "conv_1" },
    pathname: "/admin/conversations/[id]",
    locale: "ko",
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

interface ConvFixture {
  id: string;
  publicId: string;
  status: "ACTIVE" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  borrower: { id: string; name: string; email: string; status: string };
  broker: {
    id: string;
    brokerageName: string;
    user: { id: string; name: string; email: string; status: string };
  };
  request: {
    id: string;
    province: string;
    city: string | null;
    status: string;
    mortgageCategory: string;
  };
  messages: Array<{
    id: string;
    body: string;
    createdAt: string;
    sender: { id: string; name: string; email: string; role: string };
  }>;
  nextCursor: string | null;
  hasMore: boolean;
}

const CONV_FIXTURE: ConvFixture = {
  id: "conv_1",
  publicId: "CONV-001",
  status: "ACTIVE",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-02T00:00:00.000Z",
  borrower: {
    id: "borrower_1",
    name: "Bob Borrower",
    email: "bob@example.com",
    status: "ACTIVE",
  },
  broker: {
    id: "broker_1",
    brokerageName: "Acme Mortgage",
    user: {
      id: "broker_user_1",
      name: "Jane Broker",
      email: "jane@example.com",
      status: "ACTIVE",
    },
  },
  request: {
    id: "req_1",
    province: "ON",
    city: null,
    status: "OPEN",
    mortgageCategory: "RESIDENTIAL",
  },
  messages: [
    {
      id: "msg_1",
      body: "Hello broker",
      createdAt: "2025-01-01T00:00:00.000Z",
      sender: {
        id: "borrower_1",
        name: "Bob Borrower",
        email: "bob@example.com",
        role: "BORROWER",
      },
    },
    {
      id: "msg_2",
      body: "Hello borrower",
      createdAt: "2025-01-01T01:00:00.000Z",
      sender: {
        id: "broker_user_1",
        name: "Jane Broker",
        email: "jane@example.com",
        role: "BROKER",
      },
    },
  ],
  nextCursor: null,
  hasMore: false,
};

import AdminConversationDetailPage from "@/pages/admin/conversations/[id]";

function mockFetchWith(conv: ConvFixture) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/admin/conversations/") && (!init?.method || init.method === "GET")) {
      return new Response(JSON.stringify(conv), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("/admin/conversations/[id]", () => {
  beforeEach(() => {
    mockInvalidate.mockClear();
    mockToast.mockClear();
  });

  it("renders parties, messages, and the ACTIVE status", async () => {
    mockFetchWith(CONV_FIXTURE);
    render(<AdminConversationDetailPage />);
    expect((await screen.findAllByText(/Bob Borrower/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Jane Broker/).length).toBeGreaterThan(0);
    expect(screen.getByText("Hello broker")).toBeInTheDocument();
    expect(screen.getByText("Hello borrower")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("back link points to /admin/activity?type=CONV", async () => {
    mockFetchWith(CONV_FIXTURE);
    render(<AdminConversationDetailPage />);
    const link = (await screen.findByTestId("conversation-back-link")) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toMatch(/\/admin\/activity\?type=CONV/);
  });

  it("has no legacy design-system classes", async () => {
    mockFetchWith(CONV_FIXTURE);
    const { container } = render(<AdminConversationDetailPage />);
    await screen.findAllByText(/Bob Borrower/);
    const html = container.innerHTML;
    expect(html).not.toMatch(/\brounded-full\b/);
    expect(html).not.toMatch(/\brounded-(xl|2xl|lg|md)\b/);
    expect(html).not.toMatch(/\bcard-elevated\b/);
    expect(html).not.toMatch(/\bstagger-/);
    expect(html).not.toMatch(/bg-rose-\d/);
    expect(html).not.toMatch(/animate-fade/);
  });

  it("hides close button for already-closed conversations", async () => {
    mockFetchWith({ ...CONV_FIXTURE, status: "CLOSED" });
    render(<AdminConversationDetailPage />);
    await screen.findByText("CLOSED");
    expect(screen.queryByTestId("conversation-close-btn")).not.toBeInTheDocument();
  });

  it("clicking 대화 종료 opens a danger-tone confirm dialog", async () => {
    mockFetchWith(CONV_FIXTURE);
    render(<AdminConversationDetailPage />);
    await userEvent.click(await screen.findByTestId("conversation-close-btn"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("대화 종료")).toBeInTheDocument();
    const confirm = dialog.querySelector("button.bg-error-700");
    expect(confirm).not.toBeNull();
  });

  it("confirming close PUTs {status: 'CLOSED'} and invalidates", async () => {
    const fetchMock = mockFetchWith(CONV_FIXTURE);
    render(<AdminConversationDetailPage />);
    await userEvent.click(await screen.findByTestId("conversation-close-btn"));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "종료" }));

    await waitFor(() => {
      const puts = fetchMock.mock.calls.filter(
        (c) => c[1]?.method === "PUT" && String(c[0]).includes("/api/admin/conversations/"),
      );
      expect(puts).toHaveLength(1);
      const init = puts[0][1] as RequestInit;
      expect(JSON.parse(init.body as string)).toEqual({ status: "CLOSED" });
    });
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it("load-older button is hidden when hasMore=false", async () => {
    mockFetchWith(CONV_FIXTURE);
    render(<AdminConversationDetailPage />);
    await screen.findByText("Hello broker");
    expect(screen.queryByTestId("conversation-load-older")).not.toBeInTheDocument();
  });

  it("load-older fetches with messagesBefore cursor when hasMore=true", async () => {
    // The initial GET returns the fixture with hasMore=true; the paginated GET
    // returns a DIFFERENT set of messages so rendered keys stay unique.
    const olderMessages = [
      {
        id: "older_1",
        body: "older from borrower",
        createdAt: "2024-12-31T00:00:00.000Z",
        sender: {
          id: "borrower_1",
          name: "Bob Borrower",
          email: "bob@example.com",
          role: "BORROWER",
        },
      },
      {
        id: "older_2",
        body: "older from broker",
        createdAt: "2024-12-31T01:00:00.000Z",
        sender: {
          id: "broker_user_1",
          name: "Jane Broker",
          email: "jane@example.com",
          role: "BROKER",
        },
      },
    ];
    const withMore: ConvFixture = {
      ...CONV_FIXTURE,
      hasMore: true,
      nextCursor: "msg_1",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("messagesBefore=")) {
        return new Response(
          JSON.stringify({ ...withMore, messages: olderMessages, hasMore: false, nextCursor: null }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify(withMore), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminConversationDetailPage />);
    await userEvent.click(await screen.findByTestId("conversation-load-older"));
    await waitFor(() => {
      const paged = fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes("messagesBefore=msg_1"),
      );
      expect(paged.length).toBeGreaterThan(0);
    });
    // Older messages rendered too (unique ids, no React key collision).
    await waitFor(() => {
      expect(screen.getByText("older from borrower")).toBeInTheDocument();
      expect(screen.getByText("older from broker")).toBeInTheDocument();
    });
  });

  it("renders error branch on fetch failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "Gone" }), { status: 410 })),
    );
    render(<AdminConversationDetailPage />);
    expect(await screen.findByText("대화를 불러올 수 없습니다")).toBeInTheDocument();
  });
});
