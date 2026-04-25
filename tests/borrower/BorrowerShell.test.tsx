import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import BorrowerShell from "@/components/borrower/BorrowerShell";
import { BorrowerDataProvider } from "@/components/borrower/BorrowerDataContext";

// ── Mocks ────────────────────────────────────────────────────
const mockSession = vi.hoisted(() => ({
  data: {
    user: {
      id: "u1",
      name: "Jiyeon",
      email: "j@x.co",
      role: "BORROWER" as const,
    },
  },
  status: "authenticated" as "loading" | "authenticated" | "unauthenticated",
}));

const signOutMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth/react", () => ({
  useSession: () => mockSession,
  signOut: signOutMock,
}));

const routerReplace = vi.hoisted(() => vi.fn());
vi.mock("next/router", () => ({
  useRouter: () => ({
    pathname: "/borrower/dashboard",
    locale: "ko",
    push: vi.fn(),
    replace: routerReplace,
    events: { on: vi.fn(), off: vi.fn() },
  }),
}));

// ── fetch stub ──
beforeEach(() => {
  routerReplace.mockReset();
  signOutMock.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/borrowers/profile")) {
        return new Response(
          JSON.stringify({
            id: "u1",
            publicId: "ABC123",
            name: "Jiyeon",
            email: "j@x.co",
            role: "BORROWER",
            createdAt: new Date().toISOString(),
            _count: { borrowerRequests: 2, conversations: 5 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.startsWith("/api/requests")) {
        return new Response(
          JSON.stringify({
            data: [
              { id: "r1", status: "OPEN", _count: { conversations: 3 } },
              { id: "r2", status: "IN_PROGRESS", _count: { conversations: 1 } },
              { id: "r3", status: "CLOSED", _count: { conversations: 2 } },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.startsWith("/api/messages/unread")) {
        return new Response(JSON.stringify({ unread: 4 }), { status: 200 });
      }
      if (url.startsWith("/api/conversations")) {
        return new Response(
          JSON.stringify([
            { status: "ACTIVE" },
            { status: "ACTIVE" },
            { status: "CLOSED" },
          ]),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockSession.status = "authenticated";
  (mockSession.data.user as { role: string }).role = "BORROWER";
});

function renderShell(active: "dashboard" | "messages" | "profile" = "dashboard") {
  return render(
    <BorrowerDataProvider>
      <BorrowerShell active={active}>
        <div data-testid="child">child content</div>
      </BorrowerShell>
    </BorrowerDataProvider>,
  );
}

describe("BorrowerShell", () => {
  it("renders sidebar nav items + child content for authenticated borrower", async () => {
    renderShell();
    expect(await screen.findByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("대시보드")).toBeInTheDocument();
    expect(screen.getByText("메시지")).toBeInTheDocument();
    expect(screen.getByText("프로필")).toBeInTheDocument();
  });

  it("renders the borrower's name once profile resolves", async () => {
    renderShell();
    await waitFor(() => expect(screen.getByText("Jiyeon")).toBeInTheDocument());
  });

  it("renders counter badges (active requests + unread messages)", async () => {
    renderShell();
    await waitFor(() => {
      // 2 active requests (r1 OPEN + r2 IN_PROGRESS), 4 unread messages
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("4")).toBeInTheDocument();
    });
  });

  it("marks active nav item as current", async () => {
    renderShell("messages");
    await waitFor(() => {
      const active = screen
        .getAllByRole("link")
        .find((el) => el.getAttribute("aria-current") === "page");
      expect(active).toBeTruthy();
      expect(active!.textContent).toContain("메시지");
    });
  });

  it("redirects to /login when viewer is not a borrower", async () => {
    (mockSession.data.user as { role: string }).role = "BROKER";
    renderShell();
    await waitFor(() =>
      expect(routerReplace).toHaveBeenCalledWith(
        "/login",
        undefined,
        { locale: "ko" },
      ),
    );
  });

  it("renders skip-to-content link", async () => {
    renderShell();
    const skip = await screen.findByText(/Skip to content/i);
    expect(skip.tagName).toBe("A");
    expect(skip).toHaveAttribute("href", "#main-content");
  });

  it("sign-out opens confirm modal; confirm calls signOut with /login callback", async () => {
    renderShell();
    const signOutBtn = await screen.findByRole("button", { name: /Sign Out/i });
    (signOutBtn as HTMLElement).click();
    expect(
      await screen.findByRole("dialog", {
        name: /Sign out of your account/i,
      }),
    ).toBeInTheDocument();
    expect(signOutMock).not.toHaveBeenCalled();
    const confirmBtn = screen
      .getAllByRole("button", { name: /Sign Out/i })
      .find((b) => b.className.includes("bg-error-500"));
    confirmBtn!.click();
    await waitFor(() =>
      expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: "/login" }),
    );
  });
});
