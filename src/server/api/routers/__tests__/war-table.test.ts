/**
 * @jest-environment node
 *
 * Integration tests for the warTable tRPC router (Issue #62).
 * Tests run against an in-memory SQLite database via helper functions.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "path";

import * as schema from "~/server/db/schema";
import {
  addToTodayFn,
  removeFromTodayFn,
  getTodayScheduleFn,
  reorderQueueFn,
  getAccumulatedDurationsFn,
} from "../war-table-helpers";

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

async function insertQuest(db: TestDb, userId: string) {
  const [q] = await db
    .insert(schema.quest)
    .values({ userId, name: "Test Quest" })
    .returning();
  return q!;
}

async function insertObjective(db: TestDb, questId: number) {
  const [o] = await db
    .insert(schema.objective)
    .values({ questId, name: "Test Objective" })
    .returning();
  return o!;
}

// ---------------------------------------------------------------------------
// Behavior 1 — addToToday creates a retrievable schedule item for today
// ---------------------------------------------------------------------------
describe("Behavior 1: addToToday creates a schedule item for today", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("creates a schedule item retrievable via getTodaySchedule", async () => {
    await insertUser(db, "user-wt1");
    const quest = await insertQuest(db, "user-wt1");
    const obj = await insertObjective(db, quest.id);

    await addToTodayFn(db, "user-wt1", obj.id, 60);

    const schedule = await getTodayScheduleFn(db, "user-wt1", new Date(), []);
    expect(schedule).toHaveLength(1);
    expect(schedule[0]!.objectiveId).toBe(obj.id);
    expect(schedule[0]!.intendedDuration).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// Behavior 2 — addToToday does not affect other dates
// ---------------------------------------------------------------------------
describe("Behavior 2: addToToday does not affect other dates", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("items added for today do not appear when querying with a different date", async () => {
    await insertUser(db, "user-wt2");
    const quest = await insertQuest(db, "user-wt2");
    const obj = await insertObjective(db, quest.id);

    await addToTodayFn(db, "user-wt2", obj.id, 60);

    // Query with yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const schedule = await getTodayScheduleFn(db, "user-wt2", yesterday, []);
    expect(schedule).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Behavior 3 — removeFromToday removes item; no longer appears in schedule
// ---------------------------------------------------------------------------
describe("Behavior 3: removeFromToday removes item from schedule", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("removes a schedule item so it no longer appears in getTodaySchedule", async () => {
    await insertUser(db, "user-wt3");
    const quest = await insertQuest(db, "user-wt3");
    const obj = await insertObjective(db, quest.id);

    const item = await addToTodayFn(db, "user-wt3", obj.id, 60);
    await removeFromTodayFn(db, "user-wt3", item.id);

    const schedule = await getTodayScheduleFn(db, "user-wt3", new Date(), []);
    expect(schedule).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Behavior 4 — getTodaySchedule returns items with computed scheduledStart
// ---------------------------------------------------------------------------
describe("Behavior 4: getTodaySchedule returns items with scheduledStart", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("returns scheduledStart values when windows are provided", async () => {
    await insertUser(db, "user-wt4");
    const quest = await insertQuest(db, "user-wt4");
    const obj = await insertObjective(db, quest.id);

    await addToTodayFn(db, "user-wt4", obj.id, 60);

    // Use today's date with an early morning hour (before window starts)
    const now = new Date();
    now.setHours(8, 0, 0, 0); // 08:00 today, before the 09:00 window
    const windows = [{ startTime: "09:00", endTime: "17:00" }];
    const schedule = await getTodayScheduleFn(db, "user-wt4", now, windows);

    expect(schedule).toHaveLength(1);
    expect(schedule[0]!.scheduledStart).toBeInstanceOf(Date);
    // Should start at 09:00 since currentTime is before the window
    expect(schedule[0]!.scheduledStart!.getHours()).toBe(9);
    expect(schedule[0]!.scheduledStart!.getMinutes()).toBe(0);
  });

  it("returns items without scheduledStart when no windows provided", async () => {
    await insertUser(db, "user-wt5");
    const quest = await insertQuest(db, "user-wt5");
    const obj = await insertObjective(db, quest.id);

    await addToTodayFn(db, "user-wt5", obj.id, 60);

    const schedule = await getTodayScheduleFn(db, "user-wt5", new Date(), []);
    expect(schedule).toHaveLength(1);
    expect(schedule[0]!.scheduledStart).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Behavior 6 — getAccumulatedDurations sums completed session durations per item
// ---------------------------------------------------------------------------
describe("Behavior 6: getAccumulatedDurations returns sum of completed session durations", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("returns 0 for an item with no sessions", async () => {
    await insertUser(db, "user-wt7");
    const quest = await insertQuest(db, "user-wt7");
    const obj = await insertObjective(db, quest.id);
    const item = await addToTodayFn(db, "user-wt7", obj.id, 60);

    const today = new Date().toISOString().slice(0, 10);
    const durations = await getAccumulatedDurationsFn(
      db,
      "user-wt7",
      [item.id],
      today,
    );
    expect(durations.get(item.id)).toBe(0);
  });

  it("sums actualDuration across multiple completed sessions for the same item", async () => {
    await insertUser(db, "user-wt8");
    const quest = await insertQuest(db, "user-wt8");
    const obj = await insertObjective(db, quest.id);
    const item = await addToTodayFn(db, "user-wt8", obj.id, 60);
    const today = new Date().toISOString().slice(0, 10);

    // Insert two completed sessions with known actualDuration values
    await db.insert(schema.workSession).values([
      {
        userId: "user-wt8",
        objectiveId: obj.id,
        scheduleItemId: item.id,
        date: today,
        startedAt: new Date(),
        endedAt: new Date(),
        actualDuration: 20,
      },
      {
        userId: "user-wt8",
        objectiveId: obj.id,
        scheduleItemId: item.id,
        date: today,
        startedAt: new Date(),
        endedAt: new Date(),
        actualDuration: 15,
      },
    ]);

    const durations = await getAccumulatedDurationsFn(
      db,
      "user-wt8",
      [item.id],
      today,
    );
    expect(durations.get(item.id)).toBe(35);
  });

  it("ignores sessions without an endedAt (still active)", async () => {
    await insertUser(db, "user-wt9");
    const quest = await insertQuest(db, "user-wt9");
    const obj = await insertObjective(db, quest.id);
    const item = await addToTodayFn(db, "user-wt9", obj.id, 60);
    const today = new Date().toISOString().slice(0, 10);

    // Insert one completed and one still-active session
    await db.insert(schema.workSession).values([
      {
        userId: "user-wt9",
        objectiveId: obj.id,
        scheduleItemId: item.id,
        date: today,
        startedAt: new Date(),
        endedAt: new Date(),
        actualDuration: 10,
      },
      {
        userId: "user-wt9",
        objectiveId: obj.id,
        scheduleItemId: item.id,
        date: today,
        startedAt: new Date(),
        // no endedAt — still active
      },
    ]);

    const durations = await getAccumulatedDurationsFn(
      db,
      "user-wt9",
      [item.id],
      today,
    );
    // Only the completed session's 10 minutes count
    expect(durations.get(item.id)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Behavior 5 — reorderQueue changes the order in getTodaySchedule
// ---------------------------------------------------------------------------
describe("Behavior 5: reorderQueue changes item order", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("reorders items so they appear in the new order in getTodaySchedule", async () => {
    await insertUser(db, "user-wt6");
    const quest = await insertQuest(db, "user-wt6");
    const obj1 = await insertObjective(db, quest.id);
    const obj2 = await insertObjective(db, quest.id);

    const item1 = await addToTodayFn(db, "user-wt6", obj1.id, 60);
    const item2 = await addToTodayFn(db, "user-wt6", obj2.id, 30);

    // Reverse the order: item2 first, item1 second
    await reorderQueueFn(db, "user-wt6", [item2.id, item1.id]);

    const schedule = await getTodayScheduleFn(db, "user-wt6", new Date(), []);
    expect(schedule[0]!.id).toBe(item2.id);
    expect(schedule[1]!.id).toBe(item1.id);
  });
});
