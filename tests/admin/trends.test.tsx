import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/components/admin/AdminShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    query: {},
    pathname: "/admin/system",
    locale: "ko",
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

import AdminSystemPage from "@/pages/admin/system";

describe("System > Trends (Phase 3: real /api/admin/trends)", () => {
  it("does NOT render the '예시' (synthetic-demo) label", async () => {
    // Settings + trends endpoints both return empty payloads
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url === "/api/admin/settings") {
          return new Response(JSON.stringify({}), { status: 200 });
        }
        if (url === "/api/admin/trends") {
          return new Response(
            JSON.stringify([
              { date: "2025-03-01", users: 1, requests: 2, conversations: 3 },
              { date: "2025-03-02", users: 4, requests: 5, conversations: 6 },
            ]),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }),
    );

    render(<AdminSystemPage />);
    // Loading placeholder resolves when trends come back
    await waitFor(() => {
      expect(screen.queryByText("예시")).not.toBeInTheDocument();
    });
  });

  it("hits /api/admin/trends at mount", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/admin/settings") {
        return new Response(JSON.stringify({}), { status: 200 });
      }
      if (url === "/api/admin/trends") {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminSystemPage />);
    await waitFor(() => {
      const trendsCall = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/api/admin/trends",
      );
      expect(trendsCall).toBeDefined();
    });
  });
});
