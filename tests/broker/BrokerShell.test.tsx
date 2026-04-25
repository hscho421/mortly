import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import BrokerShell from "@/components/broker/BrokerShell";
import {
  BrokerDataProvider,
  useBrokerData,
} from "@/components/broker/BrokerDataContext";

// ── Mocks ────────────────────────────────────────────────────

// next-auth/react — we control the session status per test.
const mockSession = vi.hoisted(() => ({
  data: {
    user: {
      id: "u1",
      name: "Jihoon",
      email: "j@x.co",
      role: "BROKER" as const,
    },
  },
  status: "authenticated" as "loading" | "authenticated" | "unauthenticated",
}));

const signOutMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth/react", () => ({
  useSession: () => mockSession,
  signOut: signOutMock,
}));

// next/router — we need to observe router.replace for the auth gate test.
const routerReplace = vi.hoisted(() => vi.fn());
const routerPathname = vi.hoisted(() => ({ current: "/broker/dashboard" }));

vi.mock("next/router", () => ({
  useRouter: () => ({
    pathname: routerPathname.current,
    locale: "ko",
    push: vi.fn(),
    replace: routerReplace,
    events: { on: vi.fn(), off: vi.fn() },
  }),
}));

// next-i18next: tests/setup.ts already mocks this globally.

// ── fetch stub ──
// BrokerDataContext fires three requests in parallel for counters plus a
// profile request. We return minimal, fast shapes.
beforeEach(() => {
  routerReplace.mockReset();
  signOutMock.mockReset();
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
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
          user: { id: "u1", name: "Jihoon", email: "j@x.co" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.startsWith("/api/requests")) {
      return new Response(JSON.stringify({ data: [], newCount: 3 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.startsWith("/api/messages/unread")) {
      return new Response(JSON.stringify({ unread: 5 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.startsWith("/api/conversations")) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("{}", { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockSession.status = "authenticated";
  routerPathname.current = "/broker/dashboard";
});

// ── Helper: render with provider ─
function renderShell(active: "dashboard" | "requests" | "messages" = "dashboard") {
  return render(
    <BrokerDataProvider>
      <BrokerShell active={active}>
        <div data-testid="child">child content</div>
      </BrokerShell>
    </BrokerDataProvider>,
  );
}

// ── Tests ────────────────────────────────────────────────────

describe("BrokerShell", () => {
  it("renders sidebar and child content for authenticated broker", async () => {
    renderShell();
    expect(await screen.findByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("대시보드")).toBeInTheDocument();
    expect(screen.getByText("상담 요청")).toBeInTheDocument();
    expect(screen.getByText("대화")).toBeInTheDocument();
  });

  it("shows brand mark and broker identity once profile resolves", async () => {
    renderShell();
    await waitFor(() => expect(screen.getByText("Jihoon")).toBeInTheDocument());
    expect(screen.getByText("Prime Mortgage")).toBeInTheDocument();
  });

  it("renders counter badges from the data context", async () => {
    renderShell("requests");
    // newRequests = 3, unreadMessages = 5
    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
    });
  });

  it("marks the active nav item as current", async () => {
    renderShell("messages");
    await waitFor(() => {
      const active = screen
        .getAllByRole("link")
        .find((el) => el.getAttribute("aria-current") === "page");
      expect(active).toBeTruthy();
      expect(active!.textContent).toContain("대화");
    });
  });

  it("redirects to /login when the viewer is not a broker", async () => {
    mockSession.status = "authenticated";
    // Override the session user role.
    (mockSession.data.user as { role: string }).role = "BORROWER";
    renderShell();
    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith(
        "/login",
        undefined,
        { locale: "ko" },
      );
    });
    // Restore for subsequent tests
    (mockSession.data.user as { role: string }).role = "BROKER";
  });

  it("sign-out opens a confirm modal; confirm calls signOut with /login callback", async () => {
    renderShell();
    // Wait for shell to mount, then click the sidebar's Sign Out button.
    const signOutBtn = await screen.findByRole("button", { name: /Sign Out/i });
    // There may be multiple buttons on screen — find the sidebar one (has no
    // parent modal). Using first match works because no modal is open yet.
    (signOutBtn as HTMLElement).click();

    // Confirmation modal renders.
    expect(
      await screen.findByRole("dialog", {
        name: /Sign out of your account/i,
      }),
    ).toBeInTheDocument();
    // signOut should not have fired yet.
    expect(signOutMock).not.toHaveBeenCalled();

    // Confirm the dialog — find the RED confirm button (second "Sign Out").
    const confirmBtn = screen
      .getAllByRole("button", { name: /Sign Out/i })
      .find((b) => b.className.includes("bg-error-500"));
    expect(confirmBtn).toBeTruthy();
    confirmBtn!.click();

    // signOut must be called with /login as the callbackUrl (not "/"), so the
    // user doesn't land on the marketing homepage and see a flicker of the
    // still-cached authenticated nav.
    await waitFor(() =>
      expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: "/login" }),
    );
  });

  it("sign-out cancel dismisses the modal without signing out", async () => {
    renderShell();
    const signOutBtn = await screen.findByRole("button", { name: /Sign Out/i });
    (signOutBtn as HTMLElement).click();
    const cancelBtn = await screen.findByRole("button", { name: /Cancel/i });
    cancelBtn.click();
    // Modal should be gone.
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: /Sign out of your account/i }),
      ).toBeNull(),
    );
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("renders a skip-to-content link for keyboard users", async () => {
    renderShell();
    const skip = await screen.findByText(/Skip to content/i);
    expect(skip).toBeInTheDocument();
    expect(skip.tagName).toBe("A");
    expect(skip).toHaveAttribute("href", "#main-content");
  });

  it("exposes broker profile + counters via useBrokerData", async () => {
    function Reader() {
      const { profile, counters, loaded } = useBrokerData();
      return (
        <div>
          <span data-testid="loaded">{String(loaded)}</span>
          <span data-testid="credits">{profile?.responseCredits ?? "-"}</span>
          <span data-testid="newReq">{counters.newRequests}</span>
        </div>
      );
    }
    render(
      <BrokerDataProvider>
        <Reader />
      </BrokerDataProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("loaded").textContent).toBe("true");
      expect(screen.getByTestId("credits").textContent).toBe("42");
      expect(screen.getByTestId("newReq").textContent).toBe("3");
    });
  });
});
