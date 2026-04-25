import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import RequestContextPanel from "@/components/broker/RequestContextPanel";

// next-i18next mocked globally in tests/setup.ts

describe("RequestContextPanel", () => {
  it("renders the empty state when no request", () => {
    render(<RequestContextPanel request={null} />);
    expect(
      screen.getByText(/Select a conversation to see the request behind it/i),
    ).toBeInTheDocument();
  });

  it("shows category, region, product, publicId, and 'view full request'", () => {
    render(
      <RequestContextPanel
        request={{
          id: "r1",
          publicId: "700000001",
          province: "Ontario",
          city: "Toronto",
          status: "OPEN",
          mortgageCategory: "RESIDENTIAL",
          productTypes: ["NEW_MORTGAGE"],
        }}
      />,
    );
    expect(screen.getByText(/700000001/)).toBeInTheDocument();
    expect(screen.getAllByText(/request\.residential/i).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText(/Toronto, Ontario/)).toBeInTheDocument();
    const link = screen.getByRole("link", {
      name: /전체 요청 보기|View full request/i,
    });
    expect(link).toHaveAttribute("href", "/broker/requests/700000001");
  });

  it("renders a close button when onClose prop is provided", () => {
    const onClose = vi.fn();
    render(
      <RequestContextPanel
        request={{ id: "r1", publicId: "700000001", province: "ON" }}
        onClose={onClose}
      />,
    );
    const btn = screen.getByRole("button", { name: /Close/i });
    fireEvent.click(btn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("omits the 'view full request' link when publicId is missing", () => {
    render(
      <RequestContextPanel
        request={{ id: "r1", province: "Ontario" } as never}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(
      screen.getByText(/Full request data unavailable/i),
    ).toBeInTheDocument();
  });

  it("renders timeline when present", () => {
    render(
      <RequestContextPanel
        request={{
          id: "r1",
          publicId: "700000001",
          province: "Ontario",
          mortgageCategory: "RESIDENTIAL",
          desiredTimeline: "3_MONTHS",
        }}
      />,
    );
    // Our test mock returns the key string when no fallback is passed, so we
    // assert on the label-key contents.
    expect(screen.getByText(/request\.timeline3Months/)).toBeInTheDocument();
  });

  it("renders residential details (purpose of use + income types + annual income table)", () => {
    render(
      <RequestContextPanel
        request={{
          id: "r1",
          publicId: "700000001",
          province: "Ontario",
          mortgageCategory: "RESIDENTIAL",
          productTypes: ["NEW_MORTGAGE"],
          details: {
            purposeOfUse: ["OWNER_OCCUPIED"],
            incomeTypes: ["EMPLOYMENT", "DIVIDEND"],
            annualIncome: { "2024": "120000", "2023": "110000" },
          },
        }}
      />,
    );
    // Purpose-of-use value — translation keys via test mock
    expect(screen.getByText(/request\.ownerOccupied/)).toBeInTheDocument();
    // Income types rendered inline
    expect(
      screen.getByText(/request\.incomeTypes\.employment/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/request\.incomeTypes\.dividend/),
    ).toBeInTheDocument();
    // Annual income table rows
    expect(screen.getByText("2024")).toBeInTheDocument();
    expect(screen.getByText("$120000")).toBeInTheDocument();
    expect(screen.getByText("2023")).toBeInTheDocument();
    expect(screen.getByText("$110000")).toBeInTheDocument();
  });

  it("renders commercial details (business type + owner net income + corporate financials)", () => {
    render(
      <RequestContextPanel
        request={{
          id: "r2",
          publicId: "700000002",
          province: "BC",
          mortgageCategory: "COMMERCIAL",
          details: {
            businessType: "Retail",
            ownerNetIncome: "200000",
            corporateAnnualIncome: { "2024": "1200000" },
            corporateAnnualExpenses: { "2024": "800000" },
          },
        }}
      />,
    );
    expect(screen.getByText("Retail")).toBeInTheDocument();
    expect(screen.getByText("$200000")).toBeInTheDocument();
    expect(screen.getByText("$1200000")).toBeInTheDocument();
    expect(screen.getByText("$800000")).toBeInTheDocument();
  });

  it("renders notes when present", () => {
    render(
      <RequestContextPanel
        request={{
          id: "r1",
          publicId: "700000001",
          province: "Ontario",
          mortgageCategory: "RESIDENTIAL",
          notes: "First-time buyer with 20% down.",
        }}
      />,
    );
    expect(
      screen.getByText(/First-time buyer with 20% down\./),
    ).toBeInTheDocument();
  });
});
