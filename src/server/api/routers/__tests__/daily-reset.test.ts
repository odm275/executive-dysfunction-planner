/**
 * @jest-environment node
 *
 * Integration tests for War Table daily reset behavior (Issue #68).
 * Verifies that getTodaySchedule returns only items for today,
 * and that previous days' items are silently invisible.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "path";

import * as schema from "~/server/db/schema";
import { getTodayScheduleFn } from "../war-table-helpers";

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

async function insertQuestAndObjective(db: TestDb, userId: string) {
  const [q] = await db
    .insert(schema.quest)
    .values({ userId, name: "Daily Reset Test Quest" })
    .returning();
  const [o] = await db
    .insert(schema.objective)
    .values({ questId: q!.id, name: "Daily Reset Objective" })
    .returning();
  return { quest: q!, objective: o! };
}

async function insertScheduleItemForDate(
  db: TestDb,
  userId: string,
  objectiveId: number,
  date: string,
) {
  const [item] = await db
    .insert(schema.dailyScheduleItem)
    .values({ userId, objectiveId, date, intendedDuration: 60, order: 0 })
    .returning();
  return item!;
}

// ---------------------------------------------------------------------------
// Daily reset — items from previous days are invisible
// ---------------------------------------------------------------------------

describe("Issue #68: Daily reset — clean slate each morning", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("returns only items for today, not items from yesterday", async () => {
    await insertUser(db, "user-dr1");
    const { objective } = await insertQuestAndObjective(db, "user-dr1");

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    // Insert one item for yesterday and one for today
    await insertScheduleItemForDate(db, "user-dr1", objective.id, yesterdayStr);
    await insertScheduleItemForDate(db, "user-dr1", objective.id, todayStr);

    // Query with today's timestamp
    const schedule = await getTodayScheduleFn(db, "user-dr1", today, []);

    // Only today's item should appear — yesterday's is silently absent
    expect(schedule).toHaveLength(1);
  });

  it("returns empty when no items have been added for today (fresh start)", async () => {
    await insertUser(db, "user-dr2");
    const { objective } = await insertQuestAndObjective(db, "user-dr2");

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    // Insert an item for yesterday only
    await insertScheduleItemForDate(db, "user-dr2", objective.id, yesterdayStr);

    // Today's query returns nothing — clean slate
    const schedule = await getTodayScheduleFn(db, "user-dr2", new Date(), []);
    expect(schedule).toHaveLength(0);
  });

  it("returns empty when nothing has been queued at all", async () => {
    await insertUser(db, "user-dr3");
    const schedule = await getTodayScheduleFn(db, "user-dr3", new Date(), []);
    expect(schedule).toHaveLength(0);
  });
});
