import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AConfirmDialog from "@/components/admin/primitives/AConfirmDialog";

describe("AConfirmDialog", () => {
  const baseProps = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: "Test Title",
    confirmLabel: "Confirm",
  };

  it("renders title, description, and buttons when open", () => {
    render(
      <AConfirmDialog {...baseProps} description="Test description" />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
  });

  it("returns null when open=false", () => {
    render(<AConfirmDialog {...baseProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", async () => {
    const onClose = vi.fn();
    render(<AConfirmDialog {...baseProps} onClose={onClose} />);
    // Backdrop is the role=dialog element; its own click handler calls onClose
    await userEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT close on backdrop click when loading", async () => {
    const onClose = vi.fn();
    render(<AConfirmDialog {...baseProps} onClose={onClose} loading />);
    await userEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(<AConfirmDialog {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores Escape when loading", () => {
    const onClose = vi.fn();
    render(<AConfirmDialog {...baseProps} onClose={onClose} loading />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("invokes onConfirm when confirm button clicked", async () => {
    const onConfirm = vi.fn();
    render(<AConfirmDialog {...baseProps} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("danger tone uses the error-tinted confirm button", () => {
    render(<AConfirmDialog {...baseProps} tone="danger" />);
    const btn = screen.getByRole("button", { name: "Confirm" });
    // ABtn danger variant: see components/admin/primitives/ABtn.tsx
    expect(btn.className).toMatch(/bg-error-700/);
  });

  it("default tone uses the primary (amber) confirm button", () => {
    render(<AConfirmDialog {...baseProps} tone="default" />);
    const btn = screen.getByRole("button", { name: "Confirm" });
    expect(btn.className).toMatch(/bg-amber-500/);
  });

  it("disables both buttons while loading", () => {
    render(<AConfirmDialog {...baseProps} loading />);
    expect(screen.getByRole("button", { name: "취소" })).toBeDisabled();
    // When loading, the confirm label is replaced with "…"
    const confirmBtn = screen.getByRole("button", { name: "…" });
    expect(confirmBtn).toBeDisabled();
  });

  it("locks body scroll while open and restores on unmount", () => {
    const { unmount } = render(<AConfirmDialog {...baseProps} />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  // Phase 6: reason textarea --------------------------------------------

  it("renders a textarea when requireReason is set", () => {
    render(
      <AConfirmDialog
        {...baseProps}
        requireReason="optional"
        reasonLabel="Why"
        reasonPlaceholder="reason here"
      />,
    );
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("reason here")).toBeInTheDocument();
  });

  it("disables confirm when requireReason=required and textarea is empty", () => {
    render(<AConfirmDialog {...baseProps} requireReason="required" />);
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });

  it("enables confirm when requireReason=required and reason is non-empty", async () => {
    render(
      <AConfirmDialog
        {...baseProps}
        requireReason="required"
        reasonLabel="Why"
      />,
    );
    await userEvent.type(screen.getByRole("textbox"), "spam");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();
  });

  it("passes trimmed reason to onConfirm when textarea is filled", async () => {
    const onConfirm = vi.fn();
    render(
      <AConfirmDialog
        {...baseProps}
        onConfirm={onConfirm}
        requireReason="optional"
        reasonLabel="Why"
      />,
    );
    await userEvent.type(screen.getByRole("textbox"), "  has spaces  ");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledWith("has spaces");
  });

  it("passes null to onConfirm when reason textarea left blank (optional)", async () => {
    const onConfirm = vi.fn();
    render(
      <AConfirmDialog
        {...baseProps}
        onConfirm={onConfirm}
        requireReason="optional"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it("passes null to onConfirm when requireReason is not set", async () => {
    const onConfirm = vi.fn();
    render(<AConfirmDialog {...baseProps} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it("enforces reasonMaxLength on the textarea", async () => {
    render(
      <AConfirmDialog
        {...baseProps}
        requireReason="optional"
        reasonLabel="Why"
        reasonMaxLength={5}
      />,
    );
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    await userEvent.type(ta, "abcdefghij");
    expect(ta.value.length).toBe(5);
  });
});
