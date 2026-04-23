import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { useAdminUrlFilters, parseEnum } from "@/lib/admin/useAdminUrlFilters";

// Local router mock for fine-grained control over query + replace spies.
const replaceSpy = vi.fn();
let queryRef: Record<string, string | string[] | undefined> = {};
vi.mock("next/router", () => ({
  useRouter: () => ({
    query: queryRef,
    pathname: "/admin/example",
    locale: "ko",
    push: vi.fn(),
    replace: replaceSpy,
  }),
}));

function Probe<F>({
  parse,
  onReady,
}: {
  parse: (q: Record<string, string | string[] | undefined>) => F;
  onReady: (r: {
    filters: F;
    patch: (p: Record<string, string | null>) => void;
  }) => void;
}) {
  const result = useAdminUrlFilters(parse);
  onReady(result);
  return null;
}

describe("useAdminUrlFilters", () => {
  it("parses the current URL query via the supplied parse fn", () => {
    queryRef = { role: "BROKER", q: "hello" };
    let captured: unknown;
    render(
      <Probe
        parse={(q) => ({
          role: typeof q.role === "string" ? q.role : "ALL",
          q: typeof q.q === "string" ? q.q : "",
        })}
        onReady={(r) => {
          captured = r.filters;
        }}
      />,
    );
    expect(captured).toEqual({ role: "BROKER", q: "hello" });
  });

  it("patch() merges keys, preserves existing ones, and drops null values", () => {
    queryRef = { role: "BROKER", status: "ACTIVE", page: "3" };
    replaceSpy.mockClear();
    let ctl!: {
      patch: (p: Record<string, string | null>) => void;
    };
    render(
      <Probe
        parse={(q) => q}
        onReady={(r) => {
          ctl = r;
        }}
      />,
    );
    ctl.patch({ role: "BORROWER", page: null });
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    const [pathObj] = replaceSpy.mock.calls[0];
    expect(pathObj.query).toEqual({ role: "BORROWER", status: "ACTIVE" });
  });

  it("uses shallow navigation for router.replace", () => {
    queryRef = {};
    replaceSpy.mockClear();
    let ctl!: {
      patch: (p: Record<string, string | null>) => void;
    };
    render(
      <Probe
        parse={(q) => q}
        onReady={(r) => {
          ctl = r;
        }}
      />,
    );
    ctl.patch({ role: "ADMIN" });
    const [, , opts] = replaceSpy.mock.calls[0];
    expect(opts).toEqual({ shallow: true, locale: "ko" });
  });
});

describe("parseEnum", () => {
  const allowed = ["A", "B", "C"] as const;
  it("returns the value when in the allowed set", () => {
    expect(parseEnum("A", allowed, "ALL")).toBe("A");
  });
  it("returns the fallback when not in the allowed set", () => {
    expect(parseEnum("Z", allowed, "ALL")).toBe("ALL");
  });
  it("returns the fallback for non-string inputs", () => {
    expect(parseEnum(undefined, allowed, "ALL")).toBe("ALL");
    expect(parseEnum(["A"], allowed, "ALL")).toBe("ALL");
    expect(parseEnum(null, allowed, "ALL")).toBe("ALL");
  });
});
