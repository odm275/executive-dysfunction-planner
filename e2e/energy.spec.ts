import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "../src/server/db/schema";
import { test, expect } from "./fixtures";
import { TEST_DB, TEST_USER_ID } from "./global-setup";

// Run all tests in this file serially to avoid SQLite write contention
test.describe.configure({ mode: "serial" });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function clearEnergyState() {
  const client = createClient({ url: `file:${TEST_DB}` });
  const db = drizzle(client, { schema });
  await db.delete(schema.energyState);
  client.close();
}

async function seedEnergyState(value: "LOW" | "MEDIUM" | "HIGH") {
  const client = createClient({ url: `file:${TEST_DB}` });
  const db = drizzle(client, { schema });
  const today = new Date().toISOString().slice(0, 10);
  await db.delete(schema.energyState);
  await db.insert(schema.energyState).values({
    userId: TEST_USER_ID,
    value,
    date: today,
  });
  client.close();
}

// ---------------------------------------------------------------------------
// Energy Check-in tests
// ---------------------------------------------------------------------------

test.describe("Energy Check-in", () => {
  test.beforeEach(async () => {
    await clearEnergyState();
  });

  test("shows energy check-in screen when no energy set today", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await expect(
      authedPage.getByText("How's your energy today?"),
    ).toBeVisible();
  });

  test("selecting Low sets energy and shows World Map with LOW", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await authedPage.getByRole("button", { name: /^low$/i }).click();
    await expect(authedPage.getByText("Your World Map")).toBeVisible();
    await expect(authedPage.getByText("LOW", { exact: true })).toBeVisible();
  });

  test("selecting Medium sets energy and shows World Map with MEDIUM", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await authedPage.getByRole("button", { name: /^medium$/i }).click();
    await expect(authedPage.getByText("Your World Map")).toBeVisible();
    await expect(authedPage.getByText("MEDIUM", { exact: true })).toBeVisible();
  });

  test("selecting High sets energy and shows World Map with HIGH", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await authedPage.getByRole("button", { name: /^high$/i }).click();
    await expect(authedPage.getByText("Your World Map")).toBeVisible();
    await expect(authedPage.getByText("HIGH", { exact: true })).toBeVisible();
  });

  test("World Map shows update-energy button after check-in", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await authedPage.getByRole("button", { name: /^medium$/i }).click();
    await expect(
      authedPage.getByRole("button", { name: /update energy level/i }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// World Map (energy already set today)
// ---------------------------------------------------------------------------

test.describe("World Map — energy already set today", () => {
  test.beforeEach(async () => {
    await seedEnergyState("HIGH");
  });

  test("skips check-in and goes straight to World Map", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await expect(authedPage.getByText("Your World Map")).toBeVisible();
    await expect(
      authedPage.getByText("How's your energy today?"),
    ).not.toBeVisible();
  });

  test("World Map displays the pre-seeded energy level", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await expect(authedPage.getByText("HIGH", { exact: true })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Mid-day energy update
// ---------------------------------------------------------------------------

test.describe("Mid-day energy update", () => {
  test.beforeEach(async () => {
    await seedEnergyState("HIGH");
  });

  test("UpdateEnergyButton shows the current energy level", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await expect(
      authedPage.getByRole("button", { name: /update energy level/i }),
    ).toBeVisible();
    await expect(
      authedPage.getByRole("button", { name: /update energy level/i }),
    ).toContainText("Energy: High");
  });

  test("dropdown shows all three options with checkmark on current level", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await authedPage
      .getByRole("button", { name: /update energy level/i })
      .click();

    await expect(authedPage.getByRole("button", { name: /^low$/i })).toBeVisible();
    await expect(authedPage.getByRole("button", { name: /^medium$/i })).toBeVisible();
    await expect(authedPage.getByRole("button", { name: /^high$/i })).toBeVisible();

    // Current level should have a checkmark indicator
    const highOption = authedPage.getByRole("button", { name: /^high$/i });
    await expect(highOption).toContainText("✓");
  });

  test("selecting a different level updates the World Map display", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await authedPage
      .getByRole("button", { name: /update energy level/i })
      .click();
    await authedPage.getByRole("button", { name: /^low$/i }).click();

    // Dropdown closes and World Map shows updated energy
    await expect(authedPage.getByText("LOW", { exact: true })).toBeVisible();
  });

  test("button label reflects the newly selected level", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await authedPage
      .getByRole("button", { name: /update energy level/i })
      .click();
    await authedPage.getByRole("button", { name: /^low$/i }).click();

    await expect(
      authedPage.getByRole("button", { name: /update energy level/i }),
    ).toContainText("Energy: Low");
  });

  test("selecting the same level closes the dropdown without changing energy", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await authedPage
      .getByRole("button", { name: /update energy level/i })
      .click();
    await authedPage.getByRole("button", { name: /^high$/i }).click();

    // Dropdown closed, energy still shows HIGH
    await expect(authedPage.getByText("HIGH", { exact: true })).toBeVisible();
    await expect(authedPage.getByRole("button", { name: /^low$/i })).not.toBeVisible();
  });
});
