import { test as base, type Page } from "@playwright/test";

/**
 * authedPage — a Playwright Page that is already authenticated.
 *
 * Authentication is handled at the project level via storageState loaded from
 * playwright/.auth/user.json (produced by e2e/auth.setup.ts). This fixture
 * simply re-exposes `page` under the `authedPage` name so existing specs
 * don't need import changes.
 */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await use(page);
  },
});

export { expect } from "@playwright/test";
