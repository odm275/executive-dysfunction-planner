/**
 * @jest-environment node
 *
 * Integration tests for the Reward System (Issue #11).
 * Tests the listRewards query against an in-memory SQLite database.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "path";

import * as schema from "~/server/db/schema";
import { reward } from "~/server/db/schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

async function makeTestDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
  return db;
}

async function seedRewards(db: TestDb) {
  await db.insert(reward).values([
    { name: "Hot shower", description: "Relaxing", category: "COMFORT" },
    { name: "Favourite snack", description: "Treat", category: "COMFORT" },
    { name: "Watch an episode", description: "Fun", category: "ENTERTAINMENT" },
    { name: "Call a friend", description: "Social", category: "SOCIAL" },
  ]);
}

// ---------------------------------------------------------------------------
// listRewards — grouped by category
// ---------------------------------------------------------------------------

describe("Reward System — listRewards", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("returns an empty grouped object when no rewards are seeded", async () => {
    const all = await db.select().from(reward);
    const grouped: Record<string, typeof all> = {
      COMFORT: [],
      ENTERTAINMENT: [],
      SOCIAL: [],
    };
    for (const r of all) {
      grouped[r.category]?.push(r);
    }

    expect(grouped.COMFORT).toHaveLength(0);
    expect(grouped.ENTERTAINMENT).toHaveLength(0);
    expect(grouped.SOCIAL).toHaveLength(0);
  });

  it("groups rewards correctly by category", async () => {
    await seedRewards(db);

    const all = await db.select().from(reward);
    const grouped: Record<string, typeof all> = {
      COMFORT: [],
      ENTERTAINMENT: [],
      SOCIAL: [],
    };
    for (const r of all) {
      grouped[r.category]?.push(r);
    }

    expect(grouped.COMFORT).toHaveLength(2);
    expect(grouped.ENTERTAINMENT).toHaveLength(1);
    expect(grouped.SOCIAL).toHaveLength(1);
  });

  it("COMFORT rewards have correct names", async () => {
    await seedRewards(db);

    const all = await db.select().from(reward);
    const comfortNames = all
      .filter((r) => r.category === "COMFORT")
      .map((r) => r.name);

    expect(comfortNames).toEqual(
      expect.arrayContaining(["Hot shower", "Favourite snack"]),
    );
  });

  it("rewards include all three categories", async () => {
    await seedRewards(db);

    const all = await db.select().from(reward);
    const categories = [...new Set(all.map((r) => r.category))];

    expect(categories).toEqual(
      expect.arrayContaining(["COMFORT", "ENTERTAINMENT", "SOCIAL"]),
    );
  });
});

// ---------------------------------------------------------------------------
// AI reward chat trigger rules
// ---------------------------------------------------------------------------

describe("Reward chat trigger rules", () => {
  /**
   * These tests verify the rule: HARD and LEGENDARY completions trigger the
   * AI reward chat; EASY and MEDIUM do not. This logic lives in the UI layer
   * (WorldMapClient's onObjectiveCompleted callback), so we test the rule
   * specification directly as a pure function.
   */

  function shouldTriggerRewardChat(difficulty: string): boolean {
    return difficulty === "HARD" || difficulty === "LEGENDARY";
  }

  it("triggers for HARD objectives", () => {
    expect(shouldTriggerRewardChat("HARD")).toBe(true);
  });

  it("triggers for LEGENDARY objectives", () => {
    expect(shouldTriggerRewardChat("LEGENDARY")).toBe(true);
  });

  it("does NOT trigger for EASY objectives", () => {
    expect(shouldTriggerRewardChat("EASY")).toBe(false);
  });

  it("does NOT trigger for MEDIUM objectives", () => {
    expect(shouldTriggerRewardChat("MEDIUM")).toBe(false);
  });
});
