import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "../src/server/db/schema";
import { test, expect } from "./fixtures";
import { TEST_DB, TEST_USER_ID } from "./global-setup";

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
    await expect(authedPage.getByText("LOW")).toBeVisible();
  });

  test("selecting Medium sets energy and shows World Map with MEDIUM", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await authedPage.getByRole("button", { name: /^medium$/i }).click();
    await expect(authedPage.getByText("Your World Map")).toBeVisible();
    await expect(authedPage.getByText("MEDIUM")).toBeVisible();
  });

  test("selecting High sets energy and shows World Map with HIGH", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await authedPage.getByRole("button", { name: /^high$/i }).click();
    await expect(authedPage.getByText("Your World Map")).toBeVisible();
    await expect(authedPage.getByText("HIGH")).toBeVisible();
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
    await expect(authedPage.getByText("HIGH")).toBeVisible();
  });
});
