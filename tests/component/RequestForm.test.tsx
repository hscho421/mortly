/** @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// RequestForm now persists draft state to sessionStorage to survive page
// refresh — but tests share a jsdom window, so leftover drafts from a
// previous test would re-hydrate as the initial state. Wipe before each.
beforeEach(() => {
  if (typeof window !== "undefined") window.sessionStorage.clear();
});

// Stub next-i18next: return the key so assertions are stable and we don't need
// to load translation JSON.
vi.mock("next-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import RequestForm from "@/components/RequestForm";
import type { CreateRequestInput } from "@/types";

type OnSubmit = (data: CreateRequestInput) => Promise<void>;

function renderForm(props: Partial<React.ComponentProps<typeof RequestForm>> = {}) {
  const onSubmit = vi.fn<OnSubmit>(async () => undefined);
  const utils = render(<RequestForm onSubmit={onSubmit} {...props} />);
  return { ...utils, onSubmit };
}

// The test stub for next-i18next returns the key verbatim, so accessible names
// are the exact translation keys. Anchor regexes with ^...$ to avoid matching
// neighbouring keys (e.g. `...employment` vs `...selfEmployment`).
const NEW_MORTGAGE = /^request\.product\.newMortgage$/;
const OWNER_OCCUPIED = /^request\.ownerOccupied$/;
const EMPLOYMENT = /^request\.incomeTypes\.employment$/;
const COMM_NEW_LOAN = /^request\.product\.commNewLoan$/;

async function goToStep(user: ReturnType<typeof userEvent.setup>, step: 2 | 3) {
  // Step 1 → 2: pick a product, click Next
  await user.click(screen.getByRole("checkbox", { name: NEW_MORTGAGE }));
  await user.click(screen.getByRole("button", { name: /Next/i }));
  if (step === 2) return;

  // Step 2 → 3: pick required fields
  await user.selectOptions(screen.getByLabelText(/province/i), "Ontario");
  await user.click(screen.getByRole("checkbox", { name: OWNER_OCCUPIED }));
  await user.click(screen.getByRole("checkbox", { name: EMPLOYMENT }));
  // Pick the current year via first income-year select
  const currentYear = String(new Date().getFullYear());
  const yearSelects = screen.getAllByRole("combobox").filter((el) =>
    Array.from((el as HTMLSelectElement).options).some((o) => o.value === currentYear)
  );
  await user.selectOptions(yearSelects[0], currentYear);
  await user.type(screen.getAllByPlaceholderText("0")[0], "100000");
  await user.selectOptions(screen.getByLabelText(/desiredTimeline/i), "ASAP");
  await user.click(screen.getByRole("button", { name: /Next/i }));
}

describe("<RequestForm />", () => {
  it("starts at step 1 with category pre-selected to RESIDENTIAL", () => {
    renderForm();
    // Step label uses `t(key, fallback)` — our stub returns the fallback when given.
    expect(screen.getByText("Basics")).toBeInTheDocument();
    // RESIDENTIAL products render; COMMERCIAL-only ones do not.
    expect(screen.getByRole("checkbox", { name: NEW_MORTGAGE })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: COMM_NEW_LOAN })).not.toBeInTheDocument();
  });

  it("disables Next on step 1 until a product is chosen", async () => {
    const user = userEvent.setup();
    renderForm();
    const next = screen.getByRole("button", { name: /Next/i });
    expect(next).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: NEW_MORTGAGE }));
    expect(next).not.toBeDisabled();
  });

  it("switching category to COMMERCIAL clears products + swaps the list", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("checkbox", { name: NEW_MORTGAGE }));
    expect((screen.getByRole("checkbox", { name: NEW_MORTGAGE }) as HTMLInputElement).checked).toBe(true);

    // Click the COMMERCIAL category card (it has text "commercial" rendered via t()).
    await user.click(screen.getByText("request.commercial"));

    expect(screen.queryByRole("checkbox", { name: NEW_MORTGAGE })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: COMM_NEW_LOAN })).toBeInTheDocument();
  });

  it("blocks navigation past step 2 when residential required fields are empty", async () => {
    const user = userEvent.setup();
    renderForm();
    await goToStep(user, 2);
    const next = screen.getByRole("button", { name: /Next/i });
    expect(next).toBeDisabled();
  });

  it("submits a fully-filled residential form via onSubmit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await goToStep(user, 3);

    // Step 3: add notes and submit.
    const notes = screen.getByLabelText(/additionalDetails/i);
    await user.type(notes, "Looking for a 5-year fixed");

    await user.click(screen.getByRole("button", { name: /request\.submit$/i }));

    expect(onSubmit).toHaveBeenCalledOnce();
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.mortgageCategory).toBe("RESIDENTIAL");
    expect(payload.productTypes).toContain("NEW_MORTGAGE");
    expect(payload.province).toBe("Ontario");
    expect(payload.desiredTimeline).toBe("ASAP");
    expect(payload.notes).toMatch(/5-year fixed/);
  });

  it("surfaces onSubmit errors in the error banner", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => {
      throw new Error("Server said no");
    });
    render(<RequestForm onSubmit={onSubmit} />);
    await goToStep(user, 3);
    await user.type(screen.getByLabelText(/additionalDetails/i), "notes");
    await user.click(screen.getByRole("button", { name: /request\.submit$/i }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Server said no")).toBeInTheDocument();
  });

  it("respects initialValues (edit mode)", async () => {
    renderForm({
      initialValues: {
        mortgageCategory: "COMMERCIAL",
        productTypes: ["COMM_NEW_LOAN"],
        province: "Ontario",
        city: "Toronto",
        details: {
          businessType: "SaaS",
          corporateAnnualIncome: {},
          corporateAnnualExpenses: {},
          ownerNetIncome: "",
        },
        desiredTimeline: "3_MONTHS",
        notes: "Refinance HQ",
      },
      submitLabel: "Save",
      submittingLabel: "Saving...",
    });

    expect(
      (screen.getByRole("checkbox", { name: /commNewLoan/i }) as HTMLInputElement).checked
    ).toBe(true);
  });
});
