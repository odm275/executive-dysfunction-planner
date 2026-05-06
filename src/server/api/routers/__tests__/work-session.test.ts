/**
 * @jest-environment node
 *
 * Integration tests for the workSession tRPC router (Issue #63).
 * Tests run against an in-memory SQLite database via helper functions.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "path";

import * as schema from "~/server/db/schema";
import {
  startSessionFn,
  pauseSessionFn,
  completeSessionFn,
  getActiveSessionFn,
} from "../work-session-helpers";

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

async function insertScheduleItem(
  db: TestDb,
  userId: string,
  objectiveId: number,
) {
  const today = new Date().toISOString().slice(0, 10);
  const [item] = await db
    .insert(schema.dailyScheduleItem)
    .values({ userId, objectiveId, date: today, intendedDuration: 60, order: 0 })
    .returning();
  return item!;
}

// ---------------------------------------------------------------------------
// Behavior 1 — startSession creates an active session retrievable via getActiveSession
// ---------------------------------------------------------------------------
describe("Behavior 1: startSession creates an active session", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("creates a session that is retrievable via getActiveSession", async () => {
    await insertUser(db, "user-ws1");
    const quest = await insertQuest(db, "user-ws1");
    const obj = await insertObjective(db, quest.id);
    const item = await insertScheduleItem(db, "user-ws1", obj.id);

    await startSessionFn(db, "user-ws1", item.id, obj.id);

    const active = await getActiveSessionFn(db, "user-ws1");
    expect(active).not.toBeNull();
    expect(active!.scheduleItemId).toBe(item.id);
    expect(active!.endedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Behavior 2 — completeSession sets endedAt and actualDuration; no longer active
// ---------------------------------------------------------------------------
describe("Behavior 2: completeSession sets endedAt and actualDuration", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("sets endedAt and actualDuration; session no longer appears as active", async () => {
    await insertUser(db, "user-ws2");
    const quest = await insertQuest(db, "user-ws2");
    const obj = await insertObjective(db, quest.id);
    const item = await insertScheduleItem(db, "user-ws2", obj.id);

    const session = await startSessionFn(db, "user-ws2", item.id, obj.id);

    // Wait a moment so actualDuration > 0 (or just complete immediately)
    const completed = await completeSessionFn(db, "user-ws2", session.id);

    expect(completed.endedAt).not.toBeNull();
    expect(completed.actualDuration).not.toBeNull();
    expect(completed.actualDuration).toBeGreaterThanOrEqual(0);

    const active = await getActiveSessionFn(db, "user-ws2");
    expect(active).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Behavior 3 — Only one active session at a time per user
// ---------------------------------------------------------------------------
describe("Behavior 3: one active session at a time per user", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("throws an error when trying to start a second session while one is active", async () => {
    await insertUser(db, "user-ws3");
    const quest = await insertQuest(db, "user-ws3");
    const obj1 = await insertObjective(db, quest.id);
    const obj2 = await insertObjective(db, quest.id);
    const item1 = await insertScheduleItem(db, "user-ws3", obj1.id);
    const item2 = await insertScheduleItem(db, "user-ws3", obj2.id);

    await startSessionFn(db, "user-ws3", item1.id, obj1.id);

    await expect(
      startSessionFn(db, "user-ws3", item2.id, obj2.id),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Behavior 4 — pauseSession does not end the session
// ---------------------------------------------------------------------------
describe("Behavior 4: pauseSession does not end the session", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("paused session still appears in getActiveSession", async () => {
    await insertUser(db, "user-ws4");
    const quest = await insertQuest(db, "user-ws4");
    const obj = await insertObjective(db, quest.id);
    const item = await insertScheduleItem(db, "user-ws4", obj.id);

    const session = await startSessionFn(db, "user-ws4", item.id, obj.id);
    await pauseSessionFn(db, "user-ws4", session.id);

    const active = await getActiveSessionFn(db, "user-ws4");
    expect(active).not.toBeNull();
    expect(active!.id).toBe(session.id);
  });
});
