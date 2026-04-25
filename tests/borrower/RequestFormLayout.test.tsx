import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import RequestFormLayout from "@/components/borrower/RequestFormLayout";
import type { CreateRequestInput } from "@/types";

const baseResidential: CreateRequestInput = {
  mortgageCategory: "RESIDENTIAL",
  productTypes: [],
  province: "",
  city: "",
  details: {
    purposeOfUse: [],
    incomeTypes: [],
    annualIncome: {},
  },
};

const baseCommercial: CreateRequestInput = {
  mortgageCategory: "COMMERCIAL",
  productTypes: [],
  province: "",
  city: "",
  details: {
    businessType: "",
    corporateAnnualIncome: {},
    corporateAnnualExpenses: {},
    ownerNetIncome: "",
  },
};

describe("RequestFormLayout", () => {
  it("renders the empty-state placeholder when form is null", () => {
    render(
      <RequestFormLayout step={1} totalSteps={3} form={null}>
        <div data-testid="child" />
      </RequestFormLayout>,
    );
    expect(
      screen.getByText(/Your request summary will appear here/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("live-updates the summary with location, products, timeline, applicant info", () => {
    const filled: CreateRequestInput = {
      ...baseResidential,
      productTypes: ["NEW_MORTGAGE"],
      province: "Ontario",
      city: "Toronto",
      desiredTimeline: "3_MONTHS",
      details: {
        purposeOfUse: ["OWNER_OCCUPIED"],
        incomeTypes: ["EMPLOYMENT", "DIVIDEND"],
        annualIncome: { "2024": "120000", "2023": "110000" },
      },
    };
    render(
      <RequestFormLayout step={2} totalSteps={3} form={filled}>
        <div />
      </RequestFormLayout>,
    );
    // Region row
    expect(screen.getByText(/Toronto, Ontario/)).toBeInTheDocument();
    // Product chip (test mock returns key strings)
    expect(
      screen.getByText(/request\.product\.newMortgage/),
    ).toBeInTheDocument();
    // Timeline
    expect(screen.getByText(/request\.timeline3Months/)).toBeInTheDocument();
    // Purpose of use
    expect(screen.getByText(/request\.ownerOccupied/)).toBeInTheDocument();
    // Both income types comma-joined
    expect(
      screen.getByText(
        /request\.incomeTypes\.employment.*request\.incomeTypes\.dividend/,
      ),
    ).toBeInTheDocument();
    // BOTH years now show, not just one (this is the fix the user asked for)
    expect(screen.getByText("2024")).toBeInTheDocument();
    expect(screen.getByText("$120000")).toBeInTheDocument();
    expect(screen.getByText("2023")).toBeInTheDocument();
    expect(screen.getByText("$110000")).toBeInTheDocument();
  });

  it("renders commercial business + corporate financials", () => {
    const filled: CreateRequestInput = {
      ...baseCommercial,
      productTypes: ["COMM_NEW_LOAN"],
      province: "Ontario",
      desiredTimeline: "1_MONTH",
      notes: "Acquiring a new retail property in downtown Toronto.",
      details: {
        businessType: "Retail",
        ownerNetIncome: "200000",
        corporateAnnualIncome: { "2024": "1200000", "2023": "1100000" },
        corporateAnnualExpenses: { "2024": "800000", "2023": "750000" },
      },
    };
    render(
      <RequestFormLayout step={3} totalSteps={3} form={filled}>
        <div />
      </RequestFormLayout>,
    );
    // Business section
    expect(screen.getByText("Retail")).toBeInTheDocument();
    expect(screen.getByText("$200000")).toBeInTheDocument();
    // Corporate financials per year (Inc $x · Exp $y)
    const year2024 = screen
      .getAllByText("2024")
      .filter((el) => el.tagName === "DT");
    expect(year2024.length).toBeGreaterThan(0);
    // Test mock for t() returns the fallback ("Inc" / "Exp") when supplied.
    expect(
      screen.getByText(/Inc \$1200000 · Exp \$800000/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Inc \$1100000 · Exp \$750000/),
    ).toBeInTheDocument();
    // Notes preview
    expect(
      screen.getByText(/Acquiring a new retail property/),
    ).toBeInTheDocument();
  });

  it("truncates long notes with an ellipsis", () => {
    const longText = "x".repeat(280);
    const filled: CreateRequestInput = {
      ...baseResidential,
      notes: longText,
    };
    render(
      <RequestFormLayout step={1} totalSteps={3} form={filled}>
        <div />
      </RequestFormLayout>,
    );
    expect(screen.getByText(/x{240}…/)).toBeInTheDocument();
  });

  it("uses lg:top-24 sticky offset so panels clear the AppTopbar", () => {
    const { container } = render(
      <RequestFormLayout step={1} totalSteps={3} form={baseResidential}>
        <div />
      </RequestFormLayout>,
    );
    const stickies = container.querySelectorAll("aside");
    expect(stickies.length).toBe(2);
    for (const aside of stickies) {
      expect(aside.className).toMatch(/lg:sticky/);
      expect(aside.className).toMatch(/lg:top-24/);
    }
  });

  it("shows the step rail on lg+ with all three labels", () => {
    render(
      <RequestFormLayout step={2} totalSteps={3} form={baseResidential}>
        <div />
      </RequestFormLayout>,
    );
    expect(screen.getByText(/Basics/)).toBeInTheDocument();
    expect(screen.getByText(/Details/)).toBeInTheDocument();
    expect(screen.getByText(/Review/)).toBeInTheDocument();
  });

  it("step rail buttons for completed steps are clickable", () => {
    let jumped: number | null = null;
    render(
      <RequestFormLayout
        step={3}
        totalSteps={3}
        form={baseResidential}
        goToStep={(n) => {
          jumped = n;
        }}
      >
        <div />
      </RequestFormLayout>,
    );
    const buttons = screen.getAllByRole("button");
    const step1Btn = buttons.find((b) => b.textContent?.includes("Basics"));
    expect(step1Btn).toBeTruthy();
    (step1Btn as HTMLButtonElement).click();
    expect(jumped).toBe(1);
  });

  it("hides data sections when form is empty", () => {
    render(
      <RequestFormLayout step={1} totalSteps={3} form={baseResidential}>
        <div />
      </RequestFormLayout>,
    );
    expect(screen.queryByText(/Toronto/i)).toBeNull();
    expect(screen.queryByText(/2024/)).toBeNull();
  });
});
