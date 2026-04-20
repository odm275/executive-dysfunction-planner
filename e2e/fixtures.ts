import { test as base, type Page } from "@playwright/test";

import { TEST_SESSION_TOKEN } from "./global-setup";

/**
 * authedPage — a Playwright Page with the test user's session cookie pre-injected.
 *
 * This bypasses the magic-link flow entirely. The session token matches the row
 * seeded in global-setup, so better-auth will resolve it to TEST_USER_ID on every
 * request.
 */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await page.context().addCookies([
      {
        name: "better-auth.session_token",
        value: TEST_SESSION_TOKEN,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await use(page);
  },
});

export { expect } from "@playwright/test";
