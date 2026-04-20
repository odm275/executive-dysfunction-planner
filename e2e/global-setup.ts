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

// Stable session token — injected as a cookie by the authed fixture
export const TEST_SESSION_TOKEN = "e2e-stable-session-token-abc123";

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

  // Seed a test user and a long-lived session so tests can skip the magic-link flow
  const client = createClient({ url: `file:${TEST_DB}` });
  const db = drizzle(client, { schema });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(schema.user).values({
    id: TEST_USER_ID,
    email: TEST_USER_EMAIL,
    emailVerified: true,
    accountTier: "ADVENTURER",
    createdAt: now,
  });

  await db.insert(schema.session).values({
    id: "e2e-session-001",
    userId: TEST_USER_ID,
    token: TEST_SESSION_TOKEN,
    expiresAt,
    createdAt: now,
  });

  client.close();
}
