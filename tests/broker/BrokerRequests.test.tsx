import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import BrokerRequestsPage from "@/pages/broker/requests/index";
import BrokerRequestDetailPage from "@/pages/broker/requests/[id]";
import { BrokerDataProvider } from "@/components/broker/BrokerDataContext";

// ── Mocks ────────────────────────────────────────────────────
const sessionState = vi.hoisted(() => ({
  data: {
    user: { id: "u1", name: "Jihoon Park", email: "j@x.co", role: "BROKER" },
  },
  status: "authenticated" as const,
}));
vi.mock("next-auth/react", () => ({
  useSession: () => sessionState,
  signOut: vi.fn(),
}));

const routerState = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  push: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("next/router", () => ({
  useRouter: () => ({
    pathname: "/broker/requests",
    locale: "ko",
    query: routerState.query,
    push: routerState.push,
    replace: routerState.replace,
    events: { on: vi.fn(), off: vi.fn() },
  }),
}));

// posthog — no-op in tests
vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
    captureException: vi.fn(),
  },
}));

// Prevent the ReportButton from firing its own fetches.
vi.mock("@/components/ReportButton", () => ({
  default: () => null,
}));

// ── fetch stub shared across tests ──
const makeFetchMock = (requestOverrides?: {
  requestsData?: unknown;
  requestsStatus?: number;
  detail?: unknown;
  detailStatus?: number;
  startConversationResult?: { id: string };
}) =>
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.startsWith("/api/brokers/profile")) {
      return new Response(
        JSON.stringify({
          id: "b1",
          userId: "u1",
          brokerageName: "Prime Mortgage",
          province: "Ontario",
          verificationStatus: "VERIFIED",
          subscriptionTier: "PRO",
          responseCredits: 42,
          user: { id: "u1", name: "Jihoon Park", email: "j@x.co" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.startsWith("/api/requests/") && init?.method !== "POST") {
      return new Response(
        JSON.stringify(
          requestOverrides?.detail ?? {
            id: "r1",
            publicId: "700000001",
            mortgageCategory: "RESIDENTIAL",
            productTypes: ["NEW_MORTGAGE"],
            province: "Ontario",
            city: "Toronto",
            desiredTimeline: "3_MONTHS",
            status: "OPEN",
            createdAt: new Date().toISOString(),
            notes: "첫 주택 구매입니다. 다운페이 20% 준비.",
            details: {
              purposeOfUse: ["OWNER_OCCUPIED"],
              incomeTypes: ["EMPLOYMENT"],
              annualIncome: { "2024": "120000" },
            },
            _count: { conversations: 2 },
            conversations: [],
          },
        ),
        {
          status: requestOverrides?.detailStatus ?? 200,
          headers: { "content-type": "application/json" },
        },
      );
    }
    if (url.startsWith("/api/requests")) {
      return new Response(
        JSON.stringify(
          requestOverrides?.requestsData ?? {
            data: [
              {
                id: "r1",
                publicId: "700000001",
                mortgageCategory: "RESIDENTIAL",
                productTypes: ["NEW_MORTGAGE"],
                province: "Ontario",
                city: "Toronto",
                desiredTimeline: "3_MONTHS",
                status: "OPEN",
                createdAt: new Date().toISOString(),
                isNew: true,
                _count: { conversations: 0 },
                conversations: [],
              },
              {
                id: "r2",
                publicId: "700000002",
                mortgageCategory: "COMMERCIAL",
                productTypes: ["COMM_NEW_LOAN"],
                province: "British Columbia",
                city: null,
                desiredTimeline: null,
                status: "OPEN",
                createdAt: new Date().toISOString(),
                _count: { conversations: 3 },
                conversations: [],
              },
            ],
            newCount: 1,
            pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
          },
        ),
        {
          status: requestOverrides?.requestsStatus ?? 200,
          headers: { "content-type": "application/json" },
        },
      );
    }
    if (url.startsWith("/api/messages/unread")) {
      return new Response(JSON.stringify({ unread: 0 }), { status: 200 });
    }
    if (url.startsWith("/api/conversations") && init?.method === "POST") {
      return new Response(
        JSON.stringify(
          requestOverrides?.startConversationResult ?? { id: "conv1" },
        ),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    }
    if (url.startsWith("/api/conversations")) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  });

beforeEach(() => {
  vi.stubGlobal("fetch", makeFetchMock());
  routerState.query = {};
  routerState.push.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("BrokerRequestsPage (Phase 3 marketplace)", () => {
  it("renders the dense table with new-dot marker", async () => {
    render(
      <BrokerDataProvider>
        <BrokerRequestsPage />
      </BrokerDataProvider>,
    );
    await waitFor(() =>
      expect(screen.getAllByText("#700000001").length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText("#700000002").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("New").length).toBe(1);
  });

  it("filters with the 'Only unresponded' chip", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock({
        requestsData: {
          data: [
            {
              id: "r1",
              publicId: "700000001",
              mortgageCategory: "RESIDENTIAL",
              productTypes: ["NEW_MORTGAGE"],
              province: "Ontario",
              city: "Toronto",
              status: "OPEN",
              createdAt: new Date().toISOString(),
              // Broker already responded to r1 — client side should drop it
              // when chip is on (default).
              conversations: [{ broker: { userId: "u1" } }],
              _count: { conversations: 1 },
            },
            {
              id: "r2",
              publicId: "700000002",
              mortgageCategory: "COMMERCIAL",
              productTypes: [],
              province: "BC",
              status: "OPEN",
              createdAt: new Date().toISOString(),
              conversations: [],
              _count: { conversations: 0 },
            },
          ],
          newCount: 0,
          pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
        },
      }),
    );
    render(
      <BrokerDataProvider>
        <BrokerRequestsPage />
      </BrokerDataProvider>,
    );
    await waitFor(() =>
      expect(screen.getAllByText("#700000002").length).toBeGreaterThan(0),
    );
    // r1 is hidden by default (already responded to).
    expect(screen.queryByText("#700000001")).toBeNull();
    // Turning the chip off reveals it.
    fireEvent.click(screen.getByText(/Only unresponded/));
    await waitFor(() =>
      expect(screen.getAllByText("#700000001").length).toBeGreaterThan(0),
    );
  });

  it("shows a verification-required screen when API returns 403", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock({ requestsStatus: 403, requestsData: { error: "nope" } }),
    );
    render(
      <BrokerDataProvider>
        <BrokerRequestsPage />
      </BrokerDataProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText(/Verification Required/i)).toBeInTheDocument(),
    );
  });
});

describe("BrokerRequestDetailPage (Phase 3 detail)", () => {
  beforeEach(() => {
    routerState.query = { id: "700000001" };
  });

  it("renders category, region, posted time, product pills", async () => {
    render(
      <BrokerDataProvider>
        <BrokerRequestDetailPage />
      </BrokerDataProvider>,
    );
    await waitFor(() =>
      expect(screen.getAllByText(/주거용|Residential/i).length).toBeGreaterThan(0),
    );
    expect(screen.getByText("#700000001")).toBeInTheDocument();
    expect(screen.getByText(/Toronto, Ontario/i)).toBeInTheDocument();
  });

  it("Respond button starts a thread and redirects to messages", async () => {
    render(
      <BrokerDataProvider>
        <BrokerRequestDetailPage />
      </BrokerDataProvider>,
    );
    const respond = await screen.findByText(/상담 시작|Respond/i, {
      selector: "button",
    });
    fireEvent.click(respond);
    await waitFor(() =>
      expect(routerState.push).toHaveBeenCalledWith(
        "/broker/messages?id=conv1",
        undefined,
        { locale: "ko" },
      ),
    );
  });

  it("does not render an intro-form / proposal UI", async () => {
    render(
      <BrokerDataProvider>
        <BrokerRequestDetailPage />
      </BrokerDataProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText("#700000001")).toBeInTheDocument(),
    );
    // The reference design included fields like "금리" / rate; we explicitly
    // removed that flow.
    expect(screen.queryByText("금리")).toBeNull();
    expect(screen.queryByText(/Proposal/i)).toBeNull();
    expect(screen.queryByText(/Submit Introduction/i)).toBeNull();
  });
});
