import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import BrokerResponses, { type ConversationBroker } from "@/components/borrower/BrokerResponses";

// next-i18next + next/router are mocked globally in tests/setup.ts (t returns the
// fallback, or the key when none). Avatar/ReportButton render without session.

const conv = (
  id: string,
  name: string,
  createdAt: string,
  yearsExperience: number,
): ConversationBroker => ({
  id,
  createdAt,
  status: "ACTIVE",
  _count: { messages: 2 },
  broker: {
    id: `b_${id}`,
    brokerageName: `${name} Mortgage`,
    verificationStatus: "VERIFIED",
    yearsExperience,
    specialties: null,
    bio: null,
    profilePhoto: null,
    updatedAt: createdAt,
    user: { id: `u_${id}`, publicId: "900000000", name },
  },
});

// Alice responded first (fastest) but has less experience than Bob.
const alice = conv("1", "Alice", "2026-01-01T00:00:00Z", 3);
const bob = conv("2", "Bob", "2026-01-02T00:00:00Z", 10);

function brokerNamesInOrder() {
  return screen
    .getAllByRole("heading", { level: 3 })
    .map((h) => h.textContent);
}

describe("BrokerResponses", () => {
  it("shows an empty state when no broker has responded", () => {
    render(<BrokerResponses conversations={[]} />);
    expect(screen.getByText("brokerIntros.noIntros")).toBeInTheDocument();
  });

  it("renders a card for each responding broker", () => {
    render(<BrokerResponses conversations={[alice, bob]} />);
    expect(screen.getByRole("heading", { name: "Alice" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bob" })).toBeInTheDocument();
  });

  it("defaults to fastest-first and re-sorts by experience on demand", () => {
    render(<BrokerResponses conversations={[bob, alice]} />);
    // Default sort = fastest → earliest createdAt first (Alice before Bob).
    expect(brokerNamesInOrder()).toEqual(["Alice", "Bob"]);

    fireEvent.click(screen.getByText("brokerIntros.mostExperienced"));
    // Now most-experienced first (Bob: 10y before Alice: 3y).
    expect(brokerNamesInOrder()).toEqual(["Bob", "Alice"]);
  });
});
