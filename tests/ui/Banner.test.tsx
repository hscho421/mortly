import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Banner from "@/components/ui/Banner";

describe("Banner", () => {
  it("renders title and description", () => {
    render(<Banner title="Hello" description="Sub" />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Sub")).toBeInTheDocument();
  });

  it("applies sharp rounded-sm (no legacy rounded-2xl/xl/lg)", () => {
    const { container } = render(<Banner title="t" tone="success" />);
    const banner = container.firstElementChild as HTMLElement;
    expect(banner.className).toMatch(/rounded-sm/);
    expect(banner.className).not.toMatch(/\brounded-(2xl|xl|lg|md|full)\b/);
  });

  it("uses semantic tone tokens, not rose/sky", () => {
    const { container: success } = render(<Banner title="t" tone="success" />);
    expect((success.firstElementChild as HTMLElement).className).toMatch(/bg-success-50/);
    const { container: danger } = render(<Banner title="t" tone="danger" />);
    expect((danger.firstElementChild as HTMLElement).className).toMatch(/bg-error-50/);
    // Legacy palette must not appear
    expect((danger.firstElementChild as HTMLElement).className).not.toMatch(/bg-rose/);
  });

  it("renders an action slot", () => {
    render(
      <Banner
        title="Upgrade"
        action={<button type="button">Upgrade now</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Upgrade now" })).toBeInTheDocument();
  });

  it("renders dismiss button when onDismiss provided and calls it on click", async () => {
    const onDismiss = vi.fn();
    render(<Banner title="t" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("omits dismiss button by default", () => {
    render(<Banner title="t" />);
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
  });
});
