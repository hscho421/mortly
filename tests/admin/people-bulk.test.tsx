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

const routerReplace = vi.fn();
vi.mock("next/router", () => ({
  useRouter: () => ({
    query: {},
    pathname: "/admin/people",
    locale: "ko",
    push: vi.fn(),
    replace: routerReplace,
  }),
}));

// ── Fixture + fetch mock ────────────────────────────────────────

function usersFixture(n = 50) {
  return Array.from({ length: n }, (_, i) => ({
    id: `usr_${i}`,
    publicId: `1000000${String(i).padStart(2, "0")}`,
    email: `u${i}@example.com`,
    name: `User ${i}`,
    role: "BORROWER",
    status: "ACTIVE",
    createdAt: "2025-01-01T00:00:00.000Z",
    broker: null,
    _count: { borrowerRequests: 0, conversations: 0 },
  }));
}

function installFetch() {
  const bulkCalls: RequestInit[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/admin/users/bulk") && init?.method === "POST") {
      bulkCalls.push(init);
      const body = JSON.parse(init.body as string) as { ids: string[] };
      return new Response(
        JSON.stringify({
          results: body.ids.map((id) => ({ id, ok: true })),
          summary: { total: body.ids.length, succeeded: body.ids.length, failed: 0 },
        }),
        { status: 200 },
      );
    }
    if (url.startsWith("/api/admin/users?") && (!init?.method || init.method === "GET")) {
      const users = usersFixture(50);
      return new Response(
        JSON.stringify({
          data: users,
          pagination: { page: 1, limit: 25, total: users.length, totalPages: 2 },
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({}), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, bulkCalls };
}

import AdminPeoplePage from "@/pages/admin/people";

describe("/admin/people — bulk suspend (Phase 3: single POST /bulk)", () => {
  beforeEach(() => {
    mockInvalidate.mockClear();
    mockToast.mockClear();
    routerReplace.mockClear();
  });

  it("bulk suspend 50 users fires ONE POST to /api/admin/users/bulk (not 50 PUTs)", async () => {
    const { fetchMock, bulkCalls } = installFetch();
    render(<AdminPeoplePage />);

    // Wait for the table to load
    await screen.findByText("User 0");

    // Select-all checkbox
    const selectAll = screen.getByLabelText(/전체 선택/) as HTMLInputElement;
    await userEvent.click(selectAll);

    // Click bulk-suspend (opens confirm dialog)
    await userEvent.click(screen.getByTestId("bulk-suspend"));

    // Confirm dialog, danger tone
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector("button.bg-error-700")).not.toBeNull();

    // Confirm
    await userEvent.click(within(dialog).getByRole("button", { name: "진행" }));

    await waitFor(() => {
      expect(bulkCalls.length).toBe(1);
    });

    // The body should carry all 50 ids + SUSPENDED
    const body = JSON.parse(bulkCalls[0].body as string);
    expect(body.status).toBe("SUSPENDED");
    expect(body.ids).toHaveLength(50);

    // Zero per-row PUTs to /api/admin/users/:id
    const perRowPuts = fetchMock.mock.calls.filter(
      (c) => c[1]?.method === "PUT" && /\/api\/admin\/users\/[^/]+$/.test(String(c[0])),
    );
    expect(perRowPuts).toHaveLength(0);

    expect(mockInvalidate).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(expect.stringContaining("50"), "success");
  });
});
