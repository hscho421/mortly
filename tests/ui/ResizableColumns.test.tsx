import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  useResizableColumns,
  ColumnResizeHandle,
  computeNextWidth,
} from "@/components/ResizableColumns";

// matchMedia is mocked in tests/setup.ts to report matches:true (lg+), so the
// resize feature is active here.

const KEY = "mortly:msg-cols:test";

function Harness() {
  const cols = useResizableColumns(KEY);
  return (
    <div ref={cols.containerRef} className="flex">
      <div data-testid="list" style={cols.listStyle} />
      <ColumnResizeHandle
        ariaLabel="resize list"
        onPointerDown={cols.onListHandleDown}
        onDoubleClick={cols.resetList}
      />
      <div data-testid="thread" />
      <ColumnResizeHandle
        ariaLabel="resize context"
        onPointerDown={cols.onContextHandleDown}
        onDoubleClick={cols.resetContext}
      />
      <div data-testid="context" style={cols.contextStyle} />
    </div>
  );
}

describe("useResizableColumns / ColumnResizeHandle", () => {
  beforeEach(() => {
    // The test env's localStorage lacks a usable clear(); use a clean in-memory one.
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    });
    // jsdom doesn't lay out, so clientWidth is 0 — give the container room so the
    // thread-min guard doesn't clamp every drag to the minimum.
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      value: 1400,
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error remove the override
    delete HTMLElement.prototype.clientWidth;
  });

  it("applies the current design defaults at lg (list 384 / context 320)", () => {
    render(<Harness />);
    expect(screen.getByTestId("list")).toHaveStyle({ width: "384px" });
    expect(screen.getByTestId("context")).toHaveStyle({ width: "320px" });
  });

  it("renders two resize handles", () => {
    render(<Harness />);
    expect(screen.getAllByTestId("column-resize-handle")).toHaveLength(2);
  });

  it("loads saved widths from localStorage (clamped)", () => {
    localStorage.setItem(KEY, JSON.stringify({ list: 420, context: 300 }));
    render(<Harness />);
    expect(screen.getByTestId("list")).toHaveStyle({ width: "420px" });
    expect(screen.getByTestId("context")).toHaveStyle({ width: "300px" });
  });

  it("double-click resets the column to its default", () => {
    localStorage.setItem(KEY, JSON.stringify({ list: 500, context: 300 }));
    render(<Harness />);
    expect(screen.getByTestId("list")).toHaveStyle({ width: "500px" });

    fireEvent.doubleClick(screen.getAllByTestId("column-resize-handle")[0]);
    expect(screen.getByTestId("list")).toHaveStyle({ width: "384px" });
    expect(JSON.parse(localStorage.getItem(KEY)!).list).toBe(384);
  });
});

describe("computeNextWidth (drag math)", () => {
  const TOTAL = 1400; // plenty of headroom; thread-min guard inactive

  it("list grows as you drag right (+dx)", () => {
    expect(computeNextWidth("list", 384, 60, TOTAL, 320)).toBe(444);
  });

  it("list shrinks as you drag left (−dx)", () => {
    expect(computeNextWidth("list", 384, -60, TOTAL, 320)).toBe(324);
  });

  it("context grows as you drag LEFT (−dx), since it's the right column", () => {
    expect(computeNextWidth("context", 320, -40, TOTAL, 384)).toBe(360);
    expect(computeNextWidth("context", 320, 40, TOTAL, 384)).toBe(280); // drag right shrinks it
  });

  it("clamps to the column's own min/max", () => {
    expect(computeNextWidth("list", 384, 9999, TOTAL, 320)).toBe(560); // listMax
    expect(computeNextWidth("list", 384, -9999, TOTAL, 320)).toBe(260); // listMin
    expect(computeNextWidth("context", 320, -9999, TOTAL, 384)).toBe(520); // contextMax
  });

  it("never lets the center thread collapse below its minimum", () => {
    // On a 1024px viewport with a 320px context, the list can't exceed
    // 1024 − 320 − 360(threadMin) = 344, even though listMax is 560.
    expect(computeNextWidth("list", 384, 9999, 1024, 320)).toBe(344);
  });
});
