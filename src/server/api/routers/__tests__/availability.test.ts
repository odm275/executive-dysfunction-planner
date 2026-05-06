/**
 * @jest-environment node
 *
 * Integration tests for the availability tRPC router (Issue #61).
 * Tests run against an in-memory SQLite database via helper functions that
 * mirror the procedure logic (same pattern as energy.test.ts / quest.test.ts).
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "path";

import * as schema from "~/server/db/schema";
import {
  getWeeklyTemplateFn,
  setWindowForDayFn,
  getTodayOverrideFn,
  setTodayOverrideFn,
} from "../availability-helpers";

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

async function insertUser(db: TestDb, userId: string) {
  await db.insert(schema.user).values({
    id: userId,
    email: `${userId}@test.com`,
    emailVerified: false,
    accountTier: "ADVENTURER",
  });
}

// ---------------------------------------------------------------------------
// Behavior 1 — getWeeklyTemplate returns windows for all configured days
// ---------------------------------------------------------------------------
describe("Behavior 1: getWeeklyTemplate returns all template windows", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("returns all availability windows for the user across all days", async () => {
    await insertUser(db, "user-av1");
    await setWindowForDayFn(db, "user-av1", 1, [
      { startTime: "09:00", endTime: "12:00" },
    ]);
    await setWindowForDayFn(db, "user-av1", 3, [
      { startTime: "14:00", endTime: "17:00" },
    ]);

    const result = await getWeeklyTemplateFn(db, "user-av1");
    expect(result).toHaveLength(2);
    const days = result.map((w) => w.dayOfWeek).sort();
    expect(days).toEqual([1, 3]);
  });

  it("returns empty array when no windows configured", async () => {
    await insertUser(db, "user-av2");
    const result = await getWeeklyTemplateFn(db, "user-av2");
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Behavior 2 — setWindowForDay replaces windows for that day only
// ---------------------------------------------------------------------------
describe("Behavior 2: setWindowForDay replaces windows for specified day", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("creates windows for a given day", async () => {
    await insertUser(db, "user-av3");
    await setWindowForDayFn(db, "user-av3", 1, [
      { startTime: "09:00", endTime: "12:00" },
      { startTime: "14:00", endTime: "17:00" },
    ]);

    const result = await getWeeklyTemplateFn(db, "user-av3");
    const monday = result.filter((w) => w.dayOfWeek === 1);
    expect(monday).toHaveLength(2);
  });

  it("replaces existing windows for a day on repeated calls", async () => {
    await insertUser(db, "user-av4");
    await setWindowForDayFn(db, "user-av4", 1, [
      { startTime: "09:00", endTime: "12:00" },
    ]);
    await setWindowForDayFn(db, "user-av4", 1, [
      { startTime: "10:00", endTime: "14:00" },
      { startTime: "15:00", endTime: "17:00" },
    ]);

    const result = await getWeeklyTemplateFn(db, "user-av4");
    const monday = result.filter((w) => w.dayOfWeek === 1);
    expect(monday).toHaveLength(2);
    expect(monday.some((w) => w.startTime === "09:00")).toBe(false);
  });

  it("does not affect windows for other days", async () => {
    await insertUser(db, "user-av5");
    await setWindowForDayFn(db, "user-av5", 1, [
      { startTime: "09:00", endTime: "12:00" },
    ]);
    await setWindowForDayFn(db, "user-av5", 3, [
      { startTime: "13:00", endTime: "16:00" },
    ]);

    // Replace day 1 only
    await setWindowForDayFn(db, "user-av5", 1, [
      { startTime: "10:00", endTime: "13:00" },
    ]);

    const result = await getWeeklyTemplateFn(db, "user-av5");
    const wednesday = result.filter((w) => w.dayOfWeek === 3);
    expect(wednesday).toHaveLength(1);
    expect(wednesday[0]!.startTime).toBe("13:00");
  });
});

// ---------------------------------------------------------------------------
// Behavior 3 — getTodayOverride returns empty when no overrides exist
// ---------------------------------------------------------------------------
describe("Behavior 3: getTodayOverride returns empty when no overrides", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("returns empty array when no today override is set", async () => {
    await insertUser(db, "user-av6");
    const result = await getTodayOverrideFn(db, "user-av6");
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Behavior 4 — setTodayOverride stores overrides and they are retrievable
// ---------------------------------------------------------------------------
describe("Behavior 4: setTodayOverride stores and retrieves overrides", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("stores override windows and retrieves them via getTodayOverride", async () => {
    await insertUser(db, "user-av7");
    await setTodayOverrideFn(db, "user-av7", [
      { startTime: "11:00", endTime: "15:00" },
    ]);

    const result = await getTodayOverrideFn(db, "user-av7");
    expect(result).toHaveLength(1);
    expect(result[0]!.startTime).toBe("11:00");
    expect(result[0]!.endTime).toBe("15:00");
  });

  it("replaces existing overrides on repeated calls", async () => {
    await insertUser(db, "user-av8");
    await setTodayOverrideFn(db, "user-av8", [
      { startTime: "09:00", endTime: "12:00" },
    ]);
    await setTodayOverrideFn(db, "user-av8", [
      { startTime: "13:00", endTime: "16:00" },
      { startTime: "17:00", endTime: "19:00" },
    ]);

    const result = await getTodayOverrideFn(db, "user-av8");
    expect(result).toHaveLength(2);
    expect(result.some((w) => w.startTime === "09:00")).toBe(false);
  });
});
