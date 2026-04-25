import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  ConversationListSkeleton,
  ThreadSkeleton,
  RequestContextSkeleton,
} from "@/components/broker/MessagesSkeletons";

describe("Messages skeletons", () => {
  it("ConversationListSkeleton renders 6 rows with avatar placeholders", () => {
    const { container } = render(<ConversationListSkeleton />);
    // 6 rows, each with an avatar circle (h-10 w-10 rounded-full).
    const avatars = container.querySelectorAll(".rounded-full");
    expect(avatars.length).toBe(6);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("ThreadSkeleton renders alternating left/right bubbles", () => {
    const { container } = render(<ThreadSkeleton />);
    // 6 bubble rows. Each bubble row is a flex container justified to one side.
    const lefts = container.querySelectorAll(".justify-start");
    const rights = container.querySelectorAll(".justify-end");
    expect(lefts.length + rights.length).toBe(6);
    // Mix: at least one of each side.
    expect(lefts.length).toBeGreaterThan(0);
    expect(rights.length).toBeGreaterThan(0);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("RequestContextSkeleton renders a panel with header, badges, title and CTA", () => {
    const { container } = render(<RequestContextSkeleton />);
    // Panel is an <aside>.
    expect(container.querySelector("aside")).toBeTruthy();
    // Header + body + footer — three direct children.
    const panel = container.querySelector("aside")!;
    expect(panel.children.length).toBeGreaterThanOrEqual(3);
    expect(panel).toHaveAttribute("aria-hidden", "true");
  });
});
