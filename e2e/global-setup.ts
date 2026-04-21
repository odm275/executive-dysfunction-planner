import { execSync } from "child_process";
import { existsSync, unlinkSync } from "fs";
import { resolve } from "path";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "../src/server/db/schema";

export const TEST_DB = resolve("e2e-test.db");

// Stable test user identity — reused across all e2e tests
export const TEST_USER_ID = "e2e-test-user-001";
export const TEST_USER_EMAIL = "test@e2e.example.com";

export const testEnv = {
  SKIP_ENV_VALIDATION: "1",
  DATABASE_URL: `file:${TEST_DB}`,
  BETTER_AUTH_SECRET: "e2e-test-secret-not-for-production",
};

export default async function globalSetup() {
  // Start with a clean database each run
  if (existsSync(TEST_DB)) {
    unlinkSync(TEST_DB);
  }

  execSync("bun run db:push", {
    env: { ...process.env, ...testEnv },
    stdio: "pipe",
    input: Buffer.from("yes\n".repeat(5)), // answer yes to any drizzle-kit prompts
  });

  // Seed a test user — auth.setup.ts handles the real magic-link sign-in flow
  const client = createClient({ url: `file:${TEST_DB}` });
  const db = drizzle(client, { schema });

  const now = new Date();

  await db.insert(schema.user).values({
    id: TEST_USER_ID,
    email: TEST_USER_EMAIL,
    emailVerified: true,
    accountTier: "ADVENTURER",
    createdAt: now,
  });

  client.close();
}
