import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import RequestDetails from "@/components/admin/RequestDetails";

describe("RequestDetails — residential", () => {
  const BASE = {
    mortgageCategory: "RESIDENTIAL" as const,
    productTypes: ["NEW_MORTGAGE", "PRE_APPROVAL"],
    province: "ON",
    city: "Toronto",
    desiredTimeline: "1_MONTH",
  };

  it("renders region, category, timeline, and productTypes", () => {
    render(<RequestDetails {...BASE} />);
    expect(screen.getByText("Toronto, ON")).toBeInTheDocument();
    // i18n fallback comes back as the raw key — "request.residential"
    expect(screen.getByText(/주거용|request.residential/)).toBeInTheDocument();
    // Product labels fall back to their i18n keys in tests
    expect(
      screen.getByText(/NEW_MORTGAGE|request.product.newMortgage/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/PRE_APPROVAL|request.product.preApproval/),
    ).toBeInTheDocument();
  });

  it("renders purposeOfUse tags when present", () => {
    render(
      <RequestDetails
        {...BASE}
        details={{ purposeOfUse: ["OWNER_OCCUPIED", "RENTAL"] }}
      />,
    );
    expect(screen.getByText(/거주용|request.ownerOccupied/)).toBeInTheDocument();
    expect(screen.getByText(/임대용|request.rental/)).toBeInTheDocument();
  });

  it("renders incomeTypes + incomeTypeOther when OTHER is selected", () => {
    render(
      <RequestDetails
        {...BASE}
        details={{
          incomeTypes: ["EMPLOYMENT", "OTHER"],
          incomeTypeOther: "Crypto staking rewards",
        }}
      />,
    );
    expect(
      screen.getByText(/EMPLOYMENT|request.incomeTypes.employment/),
    ).toBeInTheDocument();
    expect(screen.getByText("Crypto staking rewards")).toBeInTheDocument();
  });

  it("renders the annual-income table with per-year rows", () => {
    render(
      <RequestDetails
        {...BASE}
        details={{
          annualIncome: { "2023": "85,000", "2024": "92,000" },
        }}
      />,
    );
    expect(screen.getByText("2023")).toBeInTheDocument();
    expect(screen.getByText("$85,000")).toBeInTheDocument();
    expect(screen.getByText("2024")).toBeInTheDocument();
    expect(screen.getByText("$92,000")).toBeInTheDocument();
  });

  it("sorts annual-income years descending", () => {
    render(
      <RequestDetails
        {...BASE}
        details={{
          annualIncome: { "2022": "50,000", "2024": "90,000", "2023": "70,000" },
        }}
      />,
    );
    const headers = screen.getAllByText(/202\d/);
    expect(headers.map((n) => n.textContent)).toEqual(["2024", "2023", "2022"]);
  });

  it("does NOT render an annualIncome block when empty", () => {
    render(<RequestDetails {...BASE} details={{ annualIncome: {} }} />);
    expect(screen.queryByText(/연 소득|request.annualIncome/)).not.toBeInTheDocument();
  });

  it("renders notes in italics when present", () => {
    render(<RequestDetails {...BASE} notes="Need closing by month end." />);
    expect(screen.getByText(/Need closing by month end\./)).toBeInTheDocument();
  });

  it("renders rejectionReason in the error surface", () => {
    const { container } = render(
      <RequestDetails {...BASE} rejectionReason="Insufficient documentation" />,
    );
    expect(screen.getByText(/Insufficient documentation/)).toBeInTheDocument();
    expect(container.querySelector(".bg-error-50")).not.toBeNull();
  });
});

describe("RequestDetails — commercial", () => {
  const BASE = {
    mortgageCategory: "COMMERCIAL" as const,
    productTypes: ["COMM_NEW_LOAN"],
    province: "BC",
    city: "Vancouver",
    desiredTimeline: "ASAP",
  };

  it("renders businessType", () => {
    render(
      <RequestDetails
        {...BASE}
        details={{ businessType: "Property management LLC" }}
      />,
    );
    expect(screen.getByText("Property management LLC")).toBeInTheDocument();
  });

  it("renders the corporate income + expenses table", () => {
    render(
      <RequestDetails
        {...BASE}
        details={{
          corporateAnnualIncome: { "2024": "500,000", "2023": "420,000" },
          corporateAnnualExpenses: { "2024": "340,000", "2023": "280,000" },
        }}
      />,
    );
    // Rows
    expect(screen.getByText("2024")).toBeInTheDocument();
    expect(screen.getByText("$500,000")).toBeInTheDocument();
    expect(screen.getByText("$340,000")).toBeInTheDocument();
    expect(screen.getByText("$420,000")).toBeInTheDocument();
    expect(screen.getByText("$280,000")).toBeInTheDocument();
  });

  it("handles asymmetric income/expenses (year in one but not the other)", () => {
    render(
      <RequestDetails
        {...BASE}
        details={{
          corporateAnnualIncome: { "2024": "500,000" },
          corporateAnnualExpenses: { "2023": "280,000" },
        }}
      />,
    );
    // Both years appear, with — for the missing cell
    expect(screen.getByText("2024")).toBeInTheDocument();
    expect(screen.getByText("2023")).toBeInTheDocument();
    const em = screen.getAllByText("—");
    expect(em.length).toBeGreaterThan(0);
  });

  it("renders ownerNetIncome as a dollar amount (number + string)", () => {
    const numView = render(
      <RequestDetails {...BASE} details={{ ownerNetIncome: 125000 }} />,
    );
    expect(numView.getByText("$125,000")).toBeInTheDocument();
    numView.unmount();

    render(
      <RequestDetails {...BASE} details={{ ownerNetIncome: "125,000" }} />,
    );
    expect(screen.getByText("$125,000")).toBeInTheDocument();
  });

  it("omits corporate block when both income and expenses are empty", () => {
    render(
      <RequestDetails
        {...BASE}
        details={{ corporateAnnualIncome: {}, corporateAnnualExpenses: {} }}
      />,
    );
    expect(screen.queryByText(/법인 재무|request.corporateFinancials/)).not.toBeInTheDocument();
  });
});

describe("RequestDetails — resilience", () => {
  it("renders cleanly when details is null/undefined", () => {
    render(
      <RequestDetails
        mortgageCategory="RESIDENTIAL"
        productTypes={[]}
        province="ON"
        city={null}
      />,
    );
    // Region still renders, just without city
    expect(screen.getByText("ON")).toBeInTheDocument();
  });

  it("renders — when city + province both missing", () => {
    const { container } = render(
      <RequestDetails
        mortgageCategory="RESIDENTIAL"
        productTypes={[]}
        province={null}
        city={null}
      />,
    );
    // At least one em-dash for region
    const dashes = within(container).getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });
});
