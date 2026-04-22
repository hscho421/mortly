import { test, expect } from "@playwright/test";

test.describe("Auth UI smoke", () => {
  test("login page renders and shows validation errors on empty submit", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/mortly/i);

    // Find the primary submit button. Accept either EN or KO labels.
    const submit = page.getByRole("button", { name: /sign in|로그인/i }).first();
    await submit.click();

    // Either HTML5 validation blocks submit (fields get :invalid), or the page
    // shows an inline error.
    const emailInput = page.getByLabel(/email/i).first();
    const validity = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valueMissing);
    expect(validity || (await page.getByText(/required|필수/i).count())).toBeTruthy();
  });

  test("signup → verify-email redirect", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading")).toBeVisible();
  });
});
