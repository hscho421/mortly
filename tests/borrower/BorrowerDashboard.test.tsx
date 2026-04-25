import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import BorrowerDashboard from "@/pages/borrower/dashboard";
import { BorrowerDataProvider } from "@/components/borrower/BorrowerDataContext";

// ── Mocks ────────────────────────────────────────────────────
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: { id: "u1", name: "Jiyeon Kim", email: "j@x.co", role: "BORROWER" },
    },
    status: "authenticated",
  }),
  signOut: vi.fn(),
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    pathname: "/borrower/dashboard",
    locale: "ko",
    push: vi.fn(),
    replace: vi.fn(),
    events: { on: vi.fn(), off: vi.fn() },
  }),
}));

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/borrowers/profile")) {
        return new Response(
          JSON.stringify({
            id: "u1",
            publicId: "ABC123",
            name: "Jiyeon Kim",
            email: "j@x.co",
            role: "BORROWER",
            createdAt: new Date().toISOString(),
            _count: { borrowerRequests: 3, conversations: 4 },
          }),
          { status: 200 },
        );
      }
      if (url.startsWith("/api/requests")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "r1",
                publicId: "700000001",
                province: "Ontario",
                city: "Toronto",
                status: "OPEN",
                createdAt: new Date().toISOString(),
                mortgageCategory: "RESIDENTIAL",
                productTypes: ["NEW_MORTGAGE"],
                desiredTimeline: "3_MONTHS",
                _count: { conversations: 3 },
              },
              {
                id: "r2",
                publicId: "700000002",
                province: "BC",
                status: "CLOSED",
                createdAt: new Date().toISOString(),
                mortgageCategory: "COMMERCIAL",
                productTypes: ["COMM_NEW_LOAN"],
                _count: { conversations: 1 },
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.startsWith("/api/messages/unread")) {
        return new Response(JSON.stringify({ unread: 2 }), { status: 200 });
      }
      if (url.startsWith("/api/conversations")) {
        return new Response(
          JSON.stringify([
            {
              id: "c1",
              status: "ACTIVE",
              updatedAt: new Date().toISOString(),
              unreadCount: 1,
              messages: [
                {
                  body: "Quick reply about your request.",
                  createdAt: new Date().toISOString(),
                  senderId: "broker1",
                },
              ],
              broker: {
                id: "b1",
                brokerageName: "Prime Mortgage",
                user: { id: "broker1", name: "Park Jihoon" },
              },
              request: {
                id: "r1",
                publicId: "700000001",
                province: "Ontario",
                mortgageCategory: "RESIDENTIAL",
              },
            },
          ]),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 200 });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

function renderDashboard() {
  return render(
    <BorrowerDataProvider>
      <BorrowerDashboard />
    </BorrowerDataProvider>,
  );
}

describe("BorrowerDashboard (Phase 2)", () => {
  it("renders editorial topbar with name", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText(/Jiyeon/)).toBeInTheDocument(),
    );
  });

  it("renders 2 stat cards (active requests + broker responses), no Total/Completed", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText(/Active requests/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Broker responses/)).toBeInTheDocument();
    // No legacy "Completed" / "Total Requests" stat cards.
    expect(screen.queryByText(/Completed/)).toBeNull();
  });

  it("renders the active-request hero with request id + region", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getAllByText(/700000001/).length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText(/Toronto, Ontario/).length).toBeGreaterThan(0);
  });

  it("links 'View responses' button to the broker comparison page", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText(/응답 보기|View responses/i)).toBeInTheDocument(),
    );
    const link = screen
      .getAllByRole("link")
      .find((l) =>
        l.getAttribute("href")?.startsWith("/borrower/brokers/700000001"),
      );
    expect(link).toBeTruthy();
  });

  it("renders recent activity from conversations", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText("Park Jihoon")).toBeInTheDocument(),
    );
    expect(screen.getByText(/Quick reply about your request/)).toBeInTheDocument();
  });

  it("renders all-requests list with closed requests too", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getAllByText(/700000001/).length).toBeGreaterThan(0),
    );
    expect(screen.getByText(/700000002/)).toBeInTheDocument();
  });
});
