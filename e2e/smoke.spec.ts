import { test, expect } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Create T3 App/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("sign in button is visible when logged out", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("button", { name: /sign in with github/i }),
  ).toBeVisible();
});
