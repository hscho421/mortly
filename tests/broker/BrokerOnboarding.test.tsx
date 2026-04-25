import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import BrokerOnboardingPage from "@/pages/broker/onboarding";
import { BrokerDataProvider } from "@/components/broker/BrokerDataContext";

// ── Mocks ────────────────────────────────────────────────────
const mockSession = vi.hoisted(() => ({
  data: {
    user: { id: "u1", name: "Park", email: "p@x.co", role: "BROKER" as const },
  },
  status: "authenticated" as const,
}));

vi.mock("next-auth/react", () => ({
  useSession: () => mockSession,
  signOut: vi.fn(),
}));

const routerPush = vi.hoisted(() => vi.fn());
vi.mock("next/router", () => ({
  useRouter: () => ({
    pathname: "/broker/onboarding",
    locale: "ko",
    push: routerPush,
    replace: vi.fn(),
    events: { on: vi.fn(), off: vi.fn() },
  }),
}));

// posthog — no-op
vi.mock("posthog-js", () => ({
  default: { capture: vi.fn(), captureException: vi.fn() },
}));

// Toast
vi.mock("@/components/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Track how many times /api/brokers/profile was fetched, and switch from 404
// to 200 once the profile is "created" so we can assert the post-submit
// refresh actually re-fetches.
let profileExists = false;

beforeEach(() => {
  routerPush.mockReset();
  profileExists = false;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.startsWith("/api/brokers/profile") && init?.method === "POST") {
        profileExists = true;
        return new Response(
          JSON.stringify({
            id: "b1",
            userId: "u1",
            brokerageName: "Prime Mortgage",
            province: "Ontario",
            phone: "+11234567890",
            verificationStatus: "PENDING",
            subscriptionTier: "FREE",
            responseCredits: 0,
            user: { id: "u1", name: "Park", email: "p@x.co" },
          }),
          { status: 201 },
        );
      }

      if (url.startsWith("/api/brokers/profile")) {
        if (!profileExists) {
          return new Response("{}", { status: 404 });
        }
        return new Response(
          JSON.stringify({
            id: "b1",
            userId: "u1",
            brokerageName: "Prime Mortgage",
            province: "Ontario",
            phone: "+11234567890",
            verificationStatus: "PENDING",
            subscriptionTier: "FREE",
            responseCredits: 0,
            user: { id: "u1", name: "Park", email: "p@x.co" },
          }),
          { status: 200 },
        );
      }

      // Counter-fetch endpoints — return empty data.
      if (url.startsWith("/api/requests")) {
        return new Response(JSON.stringify({ data: [], newCount: 0 }), {
          status: 200,
        });
      }
      if (url.startsWith("/api/messages/unread")) {
        return new Response(JSON.stringify({ unread: 0 }), { status: 200 });
      }
      if (url.startsWith("/api/conversations")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BrokerOnboardingPage — H1 regression", () => {
  it("refreshes BrokerDataContext before navigating to dashboard", async () => {
    render(
      <BrokerDataProvider>
        <BrokerOnboardingPage />
      </BrokerDataProvider>,
    );

    // Wait for the form to mount.
    const brokerage = await screen.findByLabelText(
      /broker\.brokerageName/i,
    );
    fireEvent.change(brokerage, { target: { value: "Prime Mortgage" } });

    const province = screen.getByLabelText(/request\.province/i);
    fireEvent.change(province, { target: { value: "Ontario" } });

    const phone = screen.getByLabelText(/broker\.phone/i);
    fireEvent.change(phone, { target: { value: "1234567890" } });

    const save = screen.getByRole("button", { name: /broker\.save/i });
    fireEvent.click(save);

    // The router must be pushed to /broker/dashboard AFTER profile creation.
    await waitFor(() =>
      expect(routerPush).toHaveBeenCalledWith(
        "/broker/dashboard",
        undefined,
        { locale: "ko" },
      ),
    );

    // And critically: the profile must have been re-fetched after the POST
    // (proving the refresh() call), so the dashboard inherits a non-null
    // profile instead of the stale 404 cache. We assert by counting the
    // GETs to /api/brokers/profile: there should be at least 2 (initial
    // mount + post-onboarding refresh).
    const fetchMock = global.fetch as unknown as { mock: { calls: unknown[][] } };
    const profileGets = fetchMock.mock.calls.filter((args) => {
      const url = String(args[0]);
      const init = args[1] as RequestInit | undefined;
      return (
        url.startsWith("/api/brokers/profile") &&
        (!init || init.method === undefined || init.method === "GET")
      );
    });
    expect(profileGets.length).toBeGreaterThanOrEqual(2);
  });
});
