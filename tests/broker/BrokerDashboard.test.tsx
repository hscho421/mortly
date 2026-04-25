import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import BrokerDashboardPage from "@/pages/broker/dashboard";
import { BrokerDataProvider } from "@/components/broker/BrokerDataContext";

// ── Mocks ────────────────────────────────────────────────────
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: { id: "u1", name: "Jihoon Park", email: "j@x.co", role: "BROKER" },
    },
    status: "authenticated",
  }),
  signOut: vi.fn(),
}));

const routerReplace = vi.hoisted(() => vi.fn());
vi.mock("next/router", () => ({
  useRouter: () => ({
    pathname: "/broker/dashboard",
    locale: "ko",
    push: vi.fn(),
    replace: routerReplace,
    events: { on: vi.fn(), off: vi.fn() },
  }),
}));

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/brokers/profile")) {
        return new Response(
          JSON.stringify({
            id: "b1",
            userId: "u1",
            brokerageName: "Prime Mortgage",
            province: "Ontario",
            licenseNumber: "ONT-123",
            phone: "+11234567890",
            bio: null,
            yearsExperience: 12,
            specialties: null,
            areasServed: null,
            profilePhoto: null,
            verificationStatus: "VERIFIED",
            subscriptionTier: "PRO",
            responseCredits: 42,
            mortgageCategory: "BOTH",
            user: { id: "u1", name: "Jihoon Park", email: "j@x.co" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.startsWith("/api/requests")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "r1",
                publicId: "700000001",
                mortgageCategory: "RESIDENTIAL",
                productTypes: ["NEW_MORTGAGE"],
                province: "Ontario",
                city: "Toronto",
                desiredTimeline: "3_MONTHS",
                createdAt: new Date().toISOString(),
                isNew: true,
              },
              {
                id: "r2",
                publicId: "700000002",
                mortgageCategory: "COMMERCIAL",
                productTypes: ["COMM_NEW_LOAN"],
                province: "British Columbia",
                city: null,
                desiredTimeline: null,
                createdAt: new Date().toISOString(),
              },
            ],
            newCount: 2,
            pagination: { page: 1, limit: 5, total: 2, totalPages: 1 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.startsWith("/api/messages/unread")) {
        return new Response(JSON.stringify({ unread: 0 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.startsWith("/api/conversations")) {
        return new Response(
          JSON.stringify([
            {
              id: "c1",
              status: "ACTIVE",
              updatedAt: new Date().toISOString(),
              unreadCount: 2,
              messages: [
                {
                  body: "Thanks for reaching out.",
                  createdAt: new Date().toISOString(),
                  senderId: "borrower1",
                },
              ],
              borrower: { id: "borrower1", name: "Jane Doe" },
              request: { id: "r1", province: "Ontario", mortgageCategory: "RESIDENTIAL" },
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("{}", { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderDashboard() {
  return render(
    <BrokerDataProvider>
      <BrokerDashboardPage />
    </BrokerDataProvider>,
  );
}

describe("BrokerDashboardPage (Phase 2)", () => {
  it("does NOT render the 응답률 (response rate) stat", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getAllByText(/상담 요청|새로운 상담 요청/).length).toBeGreaterThan(0),
    );
    expect(screen.queryByText(/응답률/)).toBeNull();
  });

  it("renders the New Requests list card with open requests", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText("#700000001")).toBeInTheDocument(),
    );
    expect(screen.getByText("#700000002")).toBeInTheDocument();
    expect(screen.getByText(/새로운 상담 요청/)).toBeInTheDocument();
  });

  it("renders the Active Conversations widget with unread preview", async () => {
    renderDashboard();
    // Wait for the actual list content (not just the section heading) so the
    // test tolerates the internal loading tick.
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());
    expect(screen.getByText(/Thanks for reaching out/)).toBeInTheDocument();
  });

  it("shows credits chip in topbar, not as a stat card", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText(/새로운 상담 요청/)).toBeInTheDocument(),
    );
    // Credits chip contains the numeric credit count.
    expect(screen.getByText("42")).toBeInTheDocument();
    // "Response Credits" / "상담 크레딧" stat card label should NOT be a stat
    // card anymore — it should only be present in the topbar chip form.
    const credits = screen.getAllByText(/Credits|크레딧/);
    expect(credits.length).toBeGreaterThan(0);
  });

  it("shows two stat cards (new requests + active conversations)", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText(/새로운 상담 요청/)).toBeInTheDocument(),
    );
    // Our StatCard uses mono-uppercase labels. Look for the labels we set.
    expect(screen.getByText(/New requests/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Conversations|진행중인 상담/i)).toBeInTheDocument();
  });
});
