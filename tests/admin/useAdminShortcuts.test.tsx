import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useAdminShortcuts, type ShortcutSpec } from "@/lib/admin/useAdminShortcuts";

function Host({ shortcuts, enabled = true }: { shortcuts: ShortcutSpec[]; enabled?: boolean }) {
  useAdminShortcuts(shortcuts, enabled);
  return (
    <div>
      <input data-testid="search" />
      <textarea data-testid="notes" />
    </div>
  );
}

describe("useAdminShortcuts", () => {
  it("fires on a matching key", () => {
    const h = vi.fn();
    render(<Host shortcuts={[{ key: "j", handler: h }]} />);
    fireEvent.keyDown(window, { key: "j" });
    expect(h).toHaveBeenCalledTimes(1);
  });

  it("supports key aliases (arrays)", () => {
    const h = vi.fn();
    render(<Host shortcuts={[{ key: ["j", "ArrowDown"], handler: h }]} />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(h).toHaveBeenCalledTimes(1);
  });

  it("skips handler when target is an input (form guard on by default)", () => {
    const h = vi.fn();
    const { getByTestId } = render(<Host shortcuts={[{ key: "j", handler: h }]} />);
    const input = getByTestId("search") as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: "j" });
    expect(h).not.toHaveBeenCalled();
  });

  it("skips handler when target is a textarea", () => {
    const h = vi.fn();
    const { getByTestId } = render(<Host shortcuts={[{ key: "j", handler: h }]} />);
    fireEvent.keyDown(getByTestId("notes"), { key: "j" });
    expect(h).not.toHaveBeenCalled();
  });

  it("can opt out of form guard", () => {
    const h = vi.fn();
    const { getByTestId } = render(
      <Host shortcuts={[{ key: "j", handler: h, ignoreInForm: false }]} />,
    );
    fireEvent.keyDown(getByTestId("search"), { key: "j" });
    expect(h).toHaveBeenCalledTimes(1);
  });

  it("requires Meta when meta:true", () => {
    const h = vi.fn();
    render(<Host shortcuts={[{ key: "Enter", handler: h, meta: true }]} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(h).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Enter", metaKey: true });
    expect(h).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire a meta-false shortcut when Meta is pressed", () => {
    const h = vi.fn();
    render(<Host shortcuts={[{ key: "j", handler: h }]} />);
    fireEvent.keyDown(window, { key: "j", ctrlKey: true });
    expect(h).not.toHaveBeenCalled();
  });

  it("calls preventDefault by default", () => {
    const h = vi.fn();
    render(<Host shortcuts={[{ key: "j", handler: h }]} />);
    const ev = new KeyboardEvent("keydown", { key: "j", cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("respects preventDefault:false", () => {
    const h = vi.fn();
    render(<Host shortcuts={[{ key: "j", handler: h, preventDefault: false }]} />);
    const ev = new KeyboardEvent("keydown", { key: "j", cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("detaches listener when enabled=false", () => {
    const h = vi.fn();
    render(<Host shortcuts={[{ key: "j", handler: h }]} enabled={false} />);
    fireEvent.keyDown(window, { key: "j" });
    expect(h).not.toHaveBeenCalled();
  });
});
