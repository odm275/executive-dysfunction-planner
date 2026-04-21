/**
 * @jest-environment node
 *
 * Integration tests for the Debuff System & Counter-tools (Issue #9).
 * Tests run against an in-memory SQLite database using real migrations.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import path from "path";

import * as schema from "~/server/db/schema";
import {
  quest,
  objective,
  counterTool as counterToolTable,
} from "~/server/db/schema";

import {
  createObjectiveFn,
  updateObjectiveFn,
  addCounterToolFn,
  updateCounterToolFn,
  removeCounterToolFn,
  listCounterToolsFn,
} from "../chapter-objective-helpers";

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

async function createQuestForUser(db: TestDb, userId: string) {
  const [q] = await db
    .insert(quest)
    .values({ userId, name: "Test Quest" })
    .returning();
  return q!;
}

// ---------------------------------------------------------------------------
// Counter-tool CRUD tests
// ---------------------------------------------------------------------------

describe("Counter-tool Engine — addCounterTool", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("adds a counter-tool to a debuffed objective", async () => {
    await insertUser(db, "u1");
    const q = await createQuestForUser(db, "u1");
    const obj = await createObjectiveFn(db, "u1", {
      questId: q.id,
      name: "Hard Task",
      isDebuffed: true,
    });

    const ct = await addCounterToolFn(db, "u1", {
      objectiveId: obj.id,
      name: "Do this with partner",
    });

    expect(ct.id).toBeDefined();
    expect(ct.name).toBe("Do this with partner");
    expect(ct.objectiveId).toBe(obj.id);
  });

  it("adds a counter-tool to a non-debuffed objective (no enforcement at DB level)", async () => {
    await insertUser(db, "u2");
    const q = await createQuestForUser(db, "u2");
    const obj = await createObjectiveFn(db, "u2", {
      questId: q.id,
      name: "Normal Task",
      isDebuffed: false,
    });

    const ct = await addCounterToolFn(db, "u2", {
      objectiveId: obj.id,
      name: "15-min timer only",
    });

    expect(ct.name).toBe("15-min timer only");
  });

  it("throws when objective belongs to another user", async () => {
    await insertUser(db, "u3a");
    await insertUser(db, "u3b");
    const q = await createQuestForUser(db, "u3a");
    const obj = await createObjectiveFn(db, "u3a", {
      questId: q.id,
      name: "Task",
    });

    await expect(
      addCounterToolFn(db, "u3b", { objectiveId: obj.id, name: "Steal it" }),
    ).rejects.toThrow("Objective not found.");
  });
});

describe("Counter-tool Engine — updateCounterTool", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("updates a counter-tool's name", async () => {
    await insertUser(db, "u4");
    const q = await createQuestForUser(db, "u4");
    const obj = await createObjectiveFn(db, "u4", {
      questId: q.id,
      name: "Task",
      isDebuffed: true,
    });
    const ct = await addCounterToolFn(db, "u4", {
      objectiveId: obj.id,
      name: "Old name",
    });

    const updated = await updateCounterToolFn(db, "u4", {
      id: ct.id,
      name: "New name",
    });

    expect(updated.name).toBe("New name");
  });

  it("throws when counter-tool belongs to another user", async () => {
    await insertUser(db, "u5a");
    await insertUser(db, "u5b");
    const q = await createQuestForUser(db, "u5a");
    const obj = await createObjectiveFn(db, "u5a", {
      questId: q.id,
      name: "Task",
    });
    const ct = await addCounterToolFn(db, "u5a", {
      objectiveId: obj.id,
      name: "Mine",
    });

    await expect(
      updateCounterToolFn(db, "u5b", { id: ct.id, name: "Hijacked" }),
    ).rejects.toThrow("Counter-tool not found.");
  });
});

describe("Counter-tool Engine — removeCounterTool", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("removes a counter-tool", async () => {
    await insertUser(db, "u6");
    const q = await createQuestForUser(db, "u6");
    const obj = await createObjectiveFn(db, "u6", {
      questId: q.id,
      name: "Task",
      isDebuffed: true,
    });
    const ct = await addCounterToolFn(db, "u6", {
      objectiveId: obj.id,
      name: "Delete me",
    });

    await removeCounterToolFn(db, "u6", ct.id);

    const found = await db.query.counterTool.findFirst({
      where: eq(counterToolTable.id, ct.id),
    });
    expect(found).toBeUndefined();
  });

  it("throws when counter-tool belongs to another user", async () => {
    await insertUser(db, "u7a");
    await insertUser(db, "u7b");
    const q = await createQuestForUser(db, "u7a");
    const obj = await createObjectiveFn(db, "u7a", {
      questId: q.id,
      name: "Task",
    });
    const ct = await addCounterToolFn(db, "u7a", {
      objectiveId: obj.id,
      name: "Mine",
    });

    await expect(removeCounterToolFn(db, "u7b", ct.id)).rejects.toThrow(
      "Counter-tool not found.",
    );
  });
});

describe("Counter-tool Engine — listCounterTools", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("lists all counter-tools for an objective", async () => {
    await insertUser(db, "u8");
    const q = await createQuestForUser(db, "u8");
    const obj = await createObjectiveFn(db, "u8", {
      questId: q.id,
      name: "Task",
      isDebuffed: true,
    });

    await addCounterToolFn(db, "u8", { objectiveId: obj.id, name: "Tool A" });
    await addCounterToolFn(db, "u8", { objectiveId: obj.id, name: "Tool B" });

    const tools = await listCounterToolsFn(db, "u8", obj.id);
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(["Tool A", "Tool B"]),
    );
  });

  it("returns empty array when no counter-tools exist", async () => {
    await insertUser(db, "u9");
    const q = await createQuestForUser(db, "u9");
    const obj = await createObjectiveFn(db, "u9", {
      questId: q.id,
      name: "Empty Task",
    });

    const tools = await listCounterToolsFn(db, "u9", obj.id);
    expect(tools).toHaveLength(0);
  });

  it("throws when objective belongs to another user", async () => {
    await insertUser(db, "u10a");
    await insertUser(db, "u10b");
    const q = await createQuestForUser(db, "u10a");
    const obj = await createObjectiveFn(db, "u10a", {
      questId: q.id,
      name: "Task",
    });

    await expect(
      listCounterToolsFn(db, "u10b", obj.id),
    ).rejects.toThrow("Objective not found.");
  });
});

describe("Debuff flag — isDebuffed toggle", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("sets isDebuffed to true on updateObjective", async () => {
    await insertUser(db, "u11");
    const q = await createQuestForUser(db, "u11");
    const obj = await createObjectiveFn(db, "u11", {
      questId: q.id,
      name: "Task",
      isDebuffed: false,
    });

    const updated = await updateObjectiveFn(db, "u11", {
      id: obj.id,
      isDebuffed: true,
    });

    expect(updated.isDebuffed).toBe(true);
  });

  it("removes isDebuffed flag on updateObjective", async () => {
    await insertUser(db, "u12");
    const q = await createQuestForUser(db, "u12");
    const obj = await createObjectiveFn(db, "u12", {
      questId: q.id,
      name: "Task",
      isDebuffed: true,
    });

    const updated = await updateObjectiveFn(db, "u12", {
      id: obj.id,
      isDebuffed: false,
    });

    expect(updated.isDebuffed).toBe(false);
  });
});

describe("Counter-tools always fetched with debuffed objectives", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("counter-tools are returned when querying objectives with counterTools relation", async () => {
    await insertUser(db, "u13");
    const q = await createQuestForUser(db, "u13");
    const obj = await createObjectiveFn(db, "u13", {
      questId: q.id,
      name: "Emotionally Charged Task",
      isDebuffed: true,
    });

    await addCounterToolFn(db, "u13", {
      objectiveId: obj.id,
      name: "Call Angelica first",
    });
    await addCounterToolFn(db, "u13", {
      objectiveId: obj.id,
      name: "15-min timer only",
    });

    // Simulate how listActiveQuests and getSuggestions fetch data
    const result = await db.query.objective.findFirst({
      where: eq(objective.id, obj.id),
      with: { counterTools: true },
    });

    expect(result!.isDebuffed).toBe(true);
    expect(result!.counterTools).toHaveLength(2);
    expect(result!.counterTools.map((ct) => ct.name)).toEqual(
      expect.arrayContaining(["Call Angelica first", "15-min timer only"]),
    );
  });

  it("counter-tools cascade-delete when objective is deleted", async () => {
    await insertUser(db, "u14");
    const q = await createQuestForUser(db, "u14");
    const obj = await createObjectiveFn(db, "u14", {
      questId: q.id,
      name: "Task",
      isDebuffed: true,
    });
    const ct = await addCounterToolFn(db, "u14", {
      objectiveId: obj.id,
      name: "Strategy",
    });

    // Delete the objective
    await db.delete(objective).where(eq(objective.id, obj.id));

    // Counter-tool should be gone (cascade delete)
    const found = await db.query.counterTool.findFirst({
      where: eq(counterToolTable.id, ct.id),
    });
    expect(found).toBeUndefined();
  });
});
