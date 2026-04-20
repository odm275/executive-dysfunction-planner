import { test, expect } from "@playwright/test";

test("unauthenticated users are redirected to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});

test("sign-in page is accessible and shows magic link form", async ({
  page,
}) => {
  await page.goto("/auth/sign-in");
  await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
});
