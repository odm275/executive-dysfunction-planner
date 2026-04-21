/**
 * @jest-environment node
 *
 * Integration tests for the Quest Engine (Issue #5).
 * Tests run against an in-memory SQLite database using real migrations.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { and, eq } from "drizzle-orm";
import path from "path";

import * as schema from "~/server/db/schema";
import { quest, objective } from "~/server/db/schema";

// Import only the pure helpers — not the tRPC router (which pulls in better-auth)
import { MAX_ACTIVE_QUESTS, autoArchiveQuestIfComplete } from "../quest-helpers";

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

async function createQuest(
  db: TestDb,
  userId: string,
  name: string,
  opts: { isSideQuest?: boolean } = {},
) {
  const [q] = await db
    .insert(quest)
    .values({ userId, name, isSideQuest: opts.isSideQuest ?? false })
    .returning();
  return q!;
}

async function createObjective(
  db: TestDb,
  questId: number,
  name: string,
  isCompleted = false,
) {
  const [o] = await db
    .insert(objective)
    .values({ questId, name, isCompleted })
    .returning();
  return o!;
}

async function countActiveQuests(db: TestDb, userId: string) {
  const rows = await db
    .select()
    .from(quest)
    .where(and(eq(quest.userId, userId), eq(quest.isArchived, false)));
  return rows.length;
}

// ---------------------------------------------------------------------------
// Inline implementations of the tRPC procedure logic (mirrors quest.ts)
// so tests can run without pulling in the tRPC / better-auth stack.
// ---------------------------------------------------------------------------

async function createQuestProcedure(
  db: TestDb,
  userId: string,
  input: { name: string; description?: string; isSideQuest?: boolean },
) {
  const activeCount = await countActiveQuests(db, userId);

  if (activeCount >= MAX_ACTIVE_QUESTS) {
    throw new Error(
      `You already have ${MAX_ACTIVE_QUESTS} active quests. Archive or complete one before adding more.`,
    );
  }

  const [q] = await db
    .insert(quest)
    .values({
      userId,
      name: input.name,
      description: input.description,
      isSideQuest: input.isSideQuest ?? false,
    })
    .returning();
  return q!;
}

async function updateQuestProcedure(
  db: TestDb,
  userId: string,
  id: number,
  fields: { name?: string; description?: string; isSideQuest?: boolean },
) {
  const existing = await db.query.quest.findFirst({
    where: and(eq(quest.id, id), eq(quest.userId, userId)),
  });
  if (!existing) throw new Error("Quest not found.");

  const [updated] = await db
    .update(quest)
    .set(fields)
    .where(and(eq(quest.id, id), eq(quest.userId, userId)))
    .returning();
  return updated!;
}

async function deleteQuestProcedure(
  db: TestDb,
  userId: string,
  id: number,
) {
  const existing = await db.query.quest.findFirst({
    where: and(eq(quest.id, id), eq(quest.userId, userId)),
  });
  if (!existing) throw new Error("Quest not found.");

  await db.delete(quest).where(and(eq(quest.id, id), eq(quest.userId, userId)));
  return { id };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Quest Engine — createQuest", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("creates a quest with default flags", async () => {
    await insertUser(db, "u1");
    const q = await createQuestProcedure(db, "u1", { name: "My Quest" });

    expect(q.name).toBe("My Quest");
    expect(q.isSideQuest).toBe(false);
    expect(q.isArchived).toBe(false);
    expect(q.userId).toBe("u1");
  });

  it("creates a quest with isSideQuest = true", async () => {
    await insertUser(db, "u2");
    const q = await createQuestProcedure(db, "u2", {
      name: "Art Journal",
      isSideQuest: true,
    });
    expect(q.isSideQuest).toBe(true);
  });

  it("enforces the 6-active-quest cap", async () => {
    await insertUser(db, "u3");
    for (let i = 0; i < MAX_ACTIVE_QUESTS; i++) {
      await createQuestProcedure(db, "u3", { name: `Quest ${i + 1}` });
    }

    await expect(
      createQuestProcedure(db, "u3", { name: "Quest 7" }),
    ).rejects.toThrow(`You already have ${MAX_ACTIVE_QUESTS} active quests`);
  });

  it("allows a 7th quest after one is archived", async () => {
    await insertUser(db, "u4");
    const quests: Awaited<ReturnType<typeof createQuestProcedure>>[] = [];
    for (let i = 0; i < MAX_ACTIVE_QUESTS; i++) {
      const q = await createQuestProcedure(db, "u4", { name: `Quest ${i + 1}` });
      quests.push(q);
    }

    // Archive one
    await db
      .update(quest)
      .set({ isArchived: true })
      .where(eq(quest.id, quests[0]!.id));

    // Now a new quest should succeed
    const newQuest = await createQuestProcedure(db, "u4", { name: "Quest 7" });
    expect(newQuest.name).toBe("Quest 7");
  });

  it("cap is per-user — different users each get 6 slots", async () => {
    await insertUser(db, "ua");
    await insertUser(db, "ub");

    for (let i = 0; i < MAX_ACTIVE_QUESTS; i++) {
      await createQuestProcedure(db, "ua", { name: `Quest ${i + 1}` });
    }

    // ua is at cap; ub should still be fine
    const q = await createQuestProcedure(db, "ub", { name: "First Quest" });
    expect(q.userId).toBe("ub");
  });
});

describe("Quest Engine — updateQuest", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("updates quest name", async () => {
    await insertUser(db, "u5");
    const q = await createQuest(db, "u5", "Old Name");
    const updated = await updateQuestProcedure(db, "u5", q.id, {
      name: "New Name",
    });
    expect(updated.name).toBe("New Name");
  });

  it("throws NOT_FOUND when quest belongs to another user", async () => {
    await insertUser(db, "u6a");
    await insertUser(db, "u6b");
    const q = await createQuest(db, "u6a", "Quest");

    await expect(
      updateQuestProcedure(db, "u6b", q.id, { name: "Hacked" }),
    ).rejects.toThrow("Quest not found.");
  });
});

describe("Quest Engine — deleteQuest", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("deletes a quest owned by the user", async () => {
    await insertUser(db, "u7");
    const q = await createQuest(db, "u7", "To Delete");
    await deleteQuestProcedure(db, "u7", q.id);

    const found = await db.query.quest.findFirst({
      where: eq(quest.id, q.id),
    });
    expect(found).toBeUndefined();
  });

  it("throws NOT_FOUND when deleting another user's quest", async () => {
    await insertUser(db, "u8a");
    await insertUser(db, "u8b");
    const q = await createQuest(db, "u8a", "Quest");

    await expect(
      deleteQuestProcedure(db, "u8b", q.id),
    ).rejects.toThrow("Quest not found.");
  });
});

describe("Quest Engine — listActiveQuests / listArchivedQuests", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("listActiveQuests returns only non-archived quests", async () => {
    await insertUser(db, "u9");
    await createQuest(db, "u9", "Active Quest");
    const archived = await createQuest(db, "u9", "Archived Quest");
    await db
      .update(quest)
      .set({ isArchived: true })
      .where(eq(quest.id, archived.id));

    const active = await db.query.quest.findMany({
      where: and(eq(quest.userId, "u9"), eq(quest.isArchived, false)),
    });
    expect(active).toHaveLength(1);
    expect(active[0]!.name).toBe("Active Quest");
  });

  it("listArchivedQuests returns only archived quests", async () => {
    await insertUser(db, "u10");
    await createQuest(db, "u10", "Active Quest");
    const archived = await createQuest(db, "u10", "Done Quest");
    await db
      .update(quest)
      .set({ isArchived: true })
      .where(eq(quest.id, archived.id));

    const archivedList = await db.query.quest.findMany({
      where: and(eq(quest.userId, "u10"), eq(quest.isArchived, true)),
    });
    expect(archivedList).toHaveLength(1);
    expect(archivedList[0]!.name).toBe("Done Quest");
  });
});

describe("Quest Engine — auto-archive trigger", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("archives the quest when all objectives are completed", async () => {
    await insertUser(db, "u11");
    const q = await createQuest(db, "u11", "Finish Me");
    const o1 = await createObjective(db, q.id, "Step 1", true);
    const o2 = await createObjective(db, q.id, "Step 2", true);

    // Sanity: both are completed
    expect(o1.isCompleted).toBe(true);
    expect(o2.isCompleted).toBe(true);

    const archived = await autoArchiveQuestIfComplete(db, q.id);
    expect(archived).toBe(true);

    const refreshed = await db.query.quest.findFirst({
      where: eq(quest.id, q.id),
    });
    expect(refreshed!.isArchived).toBe(true);
  });

  it("does NOT archive the quest when some objectives are incomplete", async () => {
    await insertUser(db, "u12");
    const q = await createQuest(db, "u12", "In Progress");
    await createObjective(db, q.id, "Done", true);
    await createObjective(db, q.id, "Not done", false);

    const archived = await autoArchiveQuestIfComplete(db, q.id);
    expect(archived).toBe(false);

    const refreshed = await db.query.quest.findFirst({
      where: eq(quest.id, q.id),
    });
    expect(refreshed!.isArchived).toBe(false);
  });

  it("does NOT archive a quest with no objectives", async () => {
    await insertUser(db, "u13");
    const q = await createQuest(db, "u13", "Empty Quest");

    const archived = await autoArchiveQuestIfComplete(db, q.id);
    expect(archived).toBe(false);

    const refreshed = await db.query.quest.findFirst({
      where: eq(quest.id, q.id),
    });
    expect(refreshed!.isArchived).toBe(false);
  });
});
