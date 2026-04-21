/**
 * auth.setup.ts — Playwright global auth setup.
 *
 * Performs a real magic-link sign-in flow against the local dev server so that
 * the resulting session cookies are saved to playwright/.auth/user.json.
 * All test projects then load that storageState and skip the sign-in UI entirely.
 *
 * Flow:
 *  1. POST /api/auth/sign-in/magic-link  → better-auth writes a verification row:
 *       verification.identifier = raw token,  verification.value = JSON({ email })
 *  2. Query e2e-test.db to find the row where value contains TEST_USER_EMAIL
 *  3. Navigate to /api/auth/magic-link/verify?token={identifier}&callbackURL=/
 *  4. Wait for redirect to "/" (authenticated)
 *  5. Save storageState → playwright/.auth/user.json
 */

import * as fs from "fs";
import * as path from "path";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { desc, like } from "drizzle-orm";
import { test as setup, expect } from "@playwright/test";

import * as schema from "../src/server/db/schema";
import { TEST_DB, TEST_USER_EMAIL } from "./global-setup";

const authFile = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  // 1. Trigger magic-link email (logged to console in dev, stored in verification table)
  await page.request.post("/api/auth/sign-in/magic-link", {
    data: { email: TEST_USER_EMAIL, callbackURL: "/" },
  });

  // 2. Read the verification token directly from the test DB.
  //    better-auth stores: identifier = token, value = JSON.stringify({ email, ... })
  const client = createClient({ url: `file:${TEST_DB}` });
  const db = drizzle(client, { schema });

  const rows = await db
    .select()
    .from(schema.verification)
    .where(like(schema.verification.value, `%${TEST_USER_EMAIL}%`))
    .orderBy(desc(schema.verification.createdAt))
    .limit(1);

  client.close();

  // The identifier column holds the raw token (storeToken defaults to "plain")
  const token = rows[0]?.identifier;
  if (!token) {
    throw new Error(
      `No magic-link verification token found for ${TEST_USER_EMAIL}. ` +
        `Make sure the dev server is running and global-setup seeded the user.`,
    );
  }

  // 3. Follow the magic-link verify URL
  await page.goto(
    `/api/auth/magic-link/verify?token=${encodeURIComponent(token)}&callbackURL=/`,
  );

  // 4. Wait until we land on "/" (better-auth redirects after verifying)
  await page.waitForURL("/", { timeout: 15_000 });
  await expect(page).toHaveURL("/");

  // 5. Persist cookies + localStorage for all tests
  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
