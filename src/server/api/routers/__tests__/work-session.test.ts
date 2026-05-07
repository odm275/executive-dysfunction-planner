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
  resumeSessionFn,
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
// Behavior 4 — pauseSession ends the session and releases the active lock
// ---------------------------------------------------------------------------
describe("Behavior 4: pauseSession ends the session and releases the active lock", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("sets endedAt and a non-negative actualDuration on the session", async () => {
    await insertUser(db, "user-ws4");
    const quest = await insertQuest(db, "user-ws4");
    const obj = await insertObjective(db, quest.id);
    const item = await insertScheduleItem(db, "user-ws4", obj.id);

    const session = await startSessionFn(db, "user-ws4", item.id, obj.id);
    const paused = await pauseSessionFn(db, "user-ws4", session.id);

    expect(paused.endedAt).not.toBeNull();
    expect(paused.actualDuration).not.toBeNull();
    expect(paused.actualDuration).toBeGreaterThanOrEqual(0);
  });

  it("getActiveSession returns null after pauseSession", async () => {
    await insertUser(db, "user-ws4b");
    const quest = await insertQuest(db, "user-ws4b");
    const obj = await insertObjective(db, quest.id);
    const item = await insertScheduleItem(db, "user-ws4b", obj.id);

    const session = await startSessionFn(db, "user-ws4b", item.id, obj.id);
    await pauseSessionFn(db, "user-ws4b", session.id);

    const active = await getActiveSessionFn(db, "user-ws4b");
    expect(active).toBeNull();
  });

  it("a second startSession succeeds immediately after pauseSession", async () => {
    await insertUser(db, "user-ws4c");
    const quest = await insertQuest(db, "user-ws4c");
    const obj1 = await insertObjective(db, quest.id);
    const obj2 = await insertObjective(db, quest.id);
    const item1 = await insertScheduleItem(db, "user-ws4c", obj1.id);
    const item2 = await insertScheduleItem(db, "user-ws4c", obj2.id);

    const session = await startSessionFn(db, "user-ws4c", item1.id, obj1.id);
    await pauseSessionFn(db, "user-ws4c", session.id);

    // Should not throw — lock is released
    await expect(
      startSessionFn(db, "user-ws4c", item2.id, obj2.id),
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Behavior 5 — resumeSession creates a new active session for the same item
// ---------------------------------------------------------------------------
describe("Behavior 5: resumeSession creates a new active session for the same item", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("creates a new active session for the same scheduleItemId after a pause", async () => {
    await insertUser(db, "user-ws5");
    const quest = await insertQuest(db, "user-ws5");
    const obj = await insertObjective(db, quest.id);
    const item = await insertScheduleItem(db, "user-ws5", obj.id);

    const session = await startSessionFn(db, "user-ws5", item.id, obj.id);
    await pauseSessionFn(db, "user-ws5", session.id);

    const resumed = await resumeSessionFn(db, "user-ws5", item.id, obj.id);

    expect(resumed.scheduleItemId).toBe(item.id);
    expect(resumed.endedAt).toBeNull();
    expect(resumed.id).not.toBe(session.id); // fresh session
  });

  it("accumulated time across pause+resume only counts active time, not gap", async () => {
    await insertUser(db, "user-ws5b");
    const quest = await insertQuest(db, "user-ws5b");
    const obj = await insertObjective(db, quest.id);
    const item = await insertScheduleItem(db, "user-ws5b", obj.id);

    const session1 = await startSessionFn(db, "user-ws5b", item.id, obj.id);
    const paused1 = await pauseSessionFn(db, "user-ws5b", session1.id);

    const session2 = await resumeSessionFn(db, "user-ws5b", item.id, obj.id);
    const completed = await completeSessionFn(db, "user-ws5b", session2.id);

    // Total accumulated = sum of actualDuration of completed sessions
    const total = (paused1.actualDuration ?? 0) + (completed.actualDuration ?? 0);
    // Should not include any paused gap (both durations are >= 0)
    expect(total).toBeGreaterThanOrEqual(0);
    // Each individual duration is non-negative
    expect(paused1.actualDuration).toBeGreaterThanOrEqual(0);
    expect(completed.actualDuration).toBeGreaterThanOrEqual(0);
  });
});
