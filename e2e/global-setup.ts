import { execSync } from "child_process";
import { existsSync, unlinkSync } from "fs";
import { resolve } from "path";

export const TEST_DB = resolve("e2e-test.db");

export const testEnv = {
  SKIP_ENV_VALIDATION: "1",
  DATABASE_URL: `file:${TEST_DB}`,
  // Placeholder OAuth credentials — only needed at startup, not for smoke tests
  BETTER_AUTH_GITHUB_CLIENT_ID: "e2e-placeholder",
  BETTER_AUTH_GITHUB_CLIENT_SECRET: "e2e-placeholder",
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
}
