import { test, expect } from "@playwright/test";

/**
 * Smoke tests: confirm the auth pages render without server errors.
 * Deliberately narrow — exhaustive form-behavior assertions live in
 * integration tests against the /api/auth handlers, not here.
 */

test.describe("Auth UI smoke", () => {
  test("login page renders with the primary h1 visible", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/mortly/i);

    // `level: 1` scopes to the h1 and ignores <h4>s in the footer.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The password input is the smoke signal that the form tree mounted.
    await expect(page.locator("input#password")).toBeVisible();
  });

  test("signup page renders with the primary h1 visible", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Email input presence confirms the signup form rendered, independent of locale.
    await expect(page.locator("input[type='email']").first()).toBeVisible();
  });
});
