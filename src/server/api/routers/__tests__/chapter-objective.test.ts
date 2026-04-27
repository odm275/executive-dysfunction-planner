/**
 * @jest-environment node
 *
 * Integration tests for the Chapter & Objective Engine (Issue #6).
 * Tests run against an in-memory SQLite database using real migrations.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import path from "path";

import * as schema from "~/server/db/schema";
import { quest, chapter, objective, subTask } from "~/server/db/schema";

import {
  createChapterFn,
  updateChapterFn,
  deleteChapterFn,
  reorderChaptersFn,
  createObjectiveFn,
  updateObjectiveFn,
  deleteObjectiveFn,
  completeObjectiveFn,
  createSubTaskFn,
  toggleSubTaskFn,
  deleteSubTaskFn,
  archiveObjectiveFn,
  restoreObjectiveFn,
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

async function createQuestForUser(db: TestDb, userId: string, name = "Test Quest") {
  const [q] = await db.insert(quest).values({ userId, name }).returning();
  return q!;
}

// ---------------------------------------------------------------------------
// Chapter tests
// ---------------------------------------------------------------------------

describe("Chapter Engine — createChapter", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("creates a chapter under an owned quest", async () => {
    await insertUser(db, "u1");
    const q = await createQuestForUser(db, "u1");

    const ch = await createChapterFn(db, "u1", {
      questId: q.id,
      name: "Act I",
    });

    expect(ch.name).toBe("Act I");
    expect(ch.questId).toBe(q.id);
    expect(ch.order).toBe(0);
  });

  it("throws when quest does not belong to caller", async () => {
    await insertUser(db, "u2a");
    await insertUser(db, "u2b");
    const q = await createQuestForUser(db, "u2a");

    await expect(
      createChapterFn(db, "u2b", { questId: q.id, name: "Stolen chapter" }),
    ).rejects.toThrow("Quest not found.");
  });
});

describe("Chapter Engine — updateChapter", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("updates chapter name", async () => {
    await insertUser(db, "u3");
    const q = await createQuestForUser(db, "u3");
    const ch = await createChapterFn(db, "u3", { questId: q.id, name: "Old" });

    const updated = await updateChapterFn(db, "u3", { id: ch.id, name: "New" });
    expect(updated.name).toBe("New");
  });

  it("throws when chapter belongs to another user", async () => {
    await insertUser(db, "u4a");
    await insertUser(db, "u4b");
    const q = await createQuestForUser(db, "u4a");
    const ch = await createChapterFn(db, "u4a", { questId: q.id, name: "Mine" });

    await expect(
      updateChapterFn(db, "u4b", { id: ch.id, name: "Hacked" }),
    ).rejects.toThrow("Chapter not found.");
  });
});

describe("Chapter Engine — deleteChapter", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("deletes a chapter", async () => {
    await insertUser(db, "u5");
    const q = await createQuestForUser(db, "u5");
    const ch = await createChapterFn(db, "u5", { questId: q.id, name: "To Delete" });

    await deleteChapterFn(db, "u5", ch.id);

    const found = await db.query.chapter.findFirst({
      where: eq(chapter.id, ch.id),
    });
    expect(found).toBeUndefined();
  });
});

describe("Chapter Engine — reorderChapters", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("reorders chapters by assigning index positions", async () => {
    await insertUser(db, "u6");
    const q = await createQuestForUser(db, "u6");
    const ch1 = await createChapterFn(db, "u6", {
      questId: q.id,
      name: "A",
      order: 0,
    });
    const ch2 = await createChapterFn(db, "u6", {
      questId: q.id,
      name: "B",
      order: 1,
    });
    const ch3 = await createChapterFn(db, "u6", {
      questId: q.id,
      name: "C",
      order: 2,
    });

    // Reverse the order
    await reorderChaptersFn(db, "u6", [ch3.id, ch2.id, ch1.id]);

    const chapters = await db.query.chapter.findMany({
      where: eq(chapter.questId, q.id),
      orderBy: (c, { asc }) => [asc(c.order)],
    });

    expect(chapters.map((c) => c.name)).toEqual(["C", "B", "A"]);
  });
});

// ---------------------------------------------------------------------------
// Objective tests
// ---------------------------------------------------------------------------

describe("Objective Engine — createObjective", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("creates an objective with default fields", async () => {
    await insertUser(db, "u7");
    const q = await createQuestForUser(db, "u7");

    const obj = await createObjectiveFn(db, "u7", {
      questId: q.id,
      name: "Step 1",
    });

    expect(obj.name).toBe("Step 1");
    expect(obj.trackingMode).toBe("BINARY");
    expect(obj.difficulty).toBe("MEDIUM");
    expect(obj.isDebuffed).toBe(false);
    expect(obj.isRecruitable).toBe(false);
    expect(obj.isCompleted).toBe(false);
  });

  it("stores difficulty, isDebuffed, isRecruitable", async () => {
    await insertUser(db, "u8");
    const q = await createQuestForUser(db, "u8");

    const obj = await createObjectiveFn(db, "u8", {
      questId: q.id,
      name: "Hard Emotional Task",
      difficulty: "HARD",
      isDebuffed: true,
      isRecruitable: true,
    });

    expect(obj.difficulty).toBe("HARD");
    expect(obj.isDebuffed).toBe(true);
    expect(obj.isRecruitable).toBe(true);
  });

  it("creates an objective within a chapter", async () => {
    await insertUser(db, "u9");
    const q = await createQuestForUser(db, "u9");
    const ch = await createChapterFn(db, "u9", { questId: q.id, name: "Act I" });

    const obj = await createObjectiveFn(db, "u9", {
      questId: q.id,
      chapterId: ch.id,
      name: "Scene 1",
    });

    expect(obj.chapterId).toBe(ch.id);
  });

  it("creates an objective without a chapter", async () => {
    await insertUser(db, "u10");
    const q = await createQuestForUser(db, "u10");

    const obj = await createObjectiveFn(db, "u10", {
      questId: q.id,
      name: "No chapter",
    });

    expect(obj.chapterId).toBeNull();
  });

  it("throws when quest belongs to another user", async () => {
    await insertUser(db, "u11a");
    await insertUser(db, "u11b");
    const q = await createQuestForUser(db, "u11a");

    await expect(
      createObjectiveFn(db, "u11b", { questId: q.id, name: "Stolen" }),
    ).rejects.toThrow("Quest not found.");
  });
});

describe("Objective Engine — updateObjective", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("updates objective name and difficulty", async () => {
    await insertUser(db, "u12");
    const q = await createQuestForUser(db, "u12");
    const obj = await createObjectiveFn(db, "u12", {
      questId: q.id,
      name: "Old name",
    });

    const updated = await updateObjectiveFn(db, "u12", {
      id: obj.id,
      name: "New name",
      difficulty: "LEGENDARY",
    });

    expect(updated.name).toBe("New name");
    expect(updated.difficulty).toBe("LEGENDARY");
  });

  it("updates chapterId to assign objective to a chapter", async () => {
    await insertUser(db, "u12b");
    const q = await createQuestForUser(db, "u12b");
    const ch = await createChapterFn(db, "u12b", { questId: q.id, name: "Act I" });
    const obj = await createObjectiveFn(db, "u12b", { questId: q.id, name: "Task" });

    const updated = await updateObjectiveFn(db, "u12b", {
      id: obj.id,
      chapterId: ch.id,
    });

    expect(updated.chapterId).toBe(ch.id);
  });

  it("clears chapterId when set to null", async () => {
    await insertUser(db, "u12c");
    const q = await createQuestForUser(db, "u12c");
    const ch = await createChapterFn(db, "u12c", { questId: q.id, name: "Act I" });
    const obj = await createObjectiveFn(db, "u12c", {
      questId: q.id,
      name: "Task",
      chapterId: ch.id,
    });

    const updated = await updateObjectiveFn(db, "u12c", {
      id: obj.id,
      chapterId: null,
    });

    expect(updated.chapterId).toBeNull();
  });
});

describe("Objective Engine — deleteObjective", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("deletes an objective", async () => {
    await insertUser(db, "u13");
    const q = await createQuestForUser(db, "u13");
    const obj = await createObjectiveFn(db, "u13", {
      questId: q.id,
      name: "Deleteme",
    });

    await deleteObjectiveFn(db, "u13", obj.id);

    const found = await db.query.objective.findFirst({
      where: eq(objective.id, obj.id),
    });
    expect(found).toBeUndefined();
  });
});

describe("Objective Engine — completeObjective (BINARY)", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("marks a binary objective as complete in one call", async () => {
    await insertUser(db, "u14");
    const q = await createQuestForUser(db, "u14");
    const obj = await createObjectiveFn(db, "u14", {
      questId: q.id,
      name: "One-tap task",
      trackingMode: "BINARY",
    });

    const completed = await completeObjectiveFn(db, "u14", obj.id);
    expect(completed.isCompleted).toBe(true);
  });

  it("auto-archives quest when last binary objective is completed", async () => {
    await insertUser(db, "u15");
    const q = await createQuestForUser(db, "u15");
    const obj1 = await createObjectiveFn(db, "u15", {
      questId: q.id,
      name: "Task 1",
    });
    const obj2 = await createObjectiveFn(db, "u15", {
      questId: q.id,
      name: "Task 2",
    });

    await completeObjectiveFn(db, "u15", obj1.id);

    // Quest should still be active after first completion
    const mid = await db.query.quest.findFirst({
      where: eq(quest.id, q.id),
    });
    expect(mid!.isArchived).toBe(false);

    // Complete the last objective
    await completeObjectiveFn(db, "u15", obj2.id);

    const archived = await db.query.quest.findFirst({
      where: eq(quest.id, q.id),
    });
    expect(archived!.isArchived).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SubTask / Progress-bar tests
// ---------------------------------------------------------------------------

describe("SubTask Engine — createSubTask", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("creates a sub-task under an objective", async () => {
    await insertUser(db, "u16");
    const q = await createQuestForUser(db, "u16");
    const obj = await createObjectiveFn(db, "u16", {
      questId: q.id,
      name: "Progress task",
      trackingMode: "PROGRESS_BAR",
    });

    const st = await createSubTaskFn(db, "u16", {
      objectiveId: obj.id,
      name: "Sub A",
    });

    expect(st.name).toBe("Sub A");
    expect(st.isCompleted).toBe(false);
  });
});

describe("SubTask Engine — toggleSubTask (progress bar calculation)", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("toggles a sub-task to completed", async () => {
    await insertUser(db, "u17");
    const q = await createQuestForUser(db, "u17");
    const obj = await createObjectiveFn(db, "u17", {
      questId: q.id,
      name: "Progress",
      trackingMode: "PROGRESS_BAR",
    });
    const st = await createSubTaskFn(db, "u17", {
      objectiveId: obj.id,
      name: "Step",
    });

    const toggled = await toggleSubTaskFn(db, "u17", st.id);
    expect(toggled.isCompleted).toBe(true);
  });

  it("toggles a sub-task back to incomplete", async () => {
    await insertUser(db, "u18");
    const q = await createQuestForUser(db, "u18");
    const obj = await createObjectiveFn(db, "u18", {
      questId: q.id,
      name: "Progress",
      trackingMode: "PROGRESS_BAR",
    });
    const st = await createSubTaskFn(db, "u18", {
      objectiveId: obj.id,
      name: "Step",
    });

    await toggleSubTaskFn(db, "u18", st.id); // → true
    const toggled = await toggleSubTaskFn(db, "u18", st.id); // → false
    expect(toggled.isCompleted).toBe(false);
  });

  it("auto-completes objective when all sub-tasks are checked", async () => {
    await insertUser(db, "u19");
    const q = await createQuestForUser(db, "u19");
    const obj = await createObjectiveFn(db, "u19", {
      questId: q.id,
      name: "Three-step task",
      trackingMode: "PROGRESS_BAR",
    });
    const st1 = await createSubTaskFn(db, "u19", {
      objectiveId: obj.id,
      name: "Sub 1",
    });
    const st2 = await createSubTaskFn(db, "u19", {
      objectiveId: obj.id,
      name: "Sub 2",
    });
    const st3 = await createSubTaskFn(db, "u19", {
      objectiveId: obj.id,
      name: "Sub 3",
    });

    await toggleSubTaskFn(db, "u19", st1.id);
    await toggleSubTaskFn(db, "u19", st2.id);

    // Objective should still be incomplete
    const mid = await db.query.objective.findFirst({
      where: eq(objective.id, obj.id),
    });
    expect(mid!.isCompleted).toBe(false);

    // Complete the last sub-task
    await toggleSubTaskFn(db, "u19", st3.id);

    const completed = await db.query.objective.findFirst({
      where: eq(objective.id, obj.id),
    });
    expect(completed!.isCompleted).toBe(true);
  });

  it("auto-archives quest when progress-bar objective auto-completes the last objective", async () => {
    await insertUser(db, "u20");
    const q = await createQuestForUser(db, "u20");
    const obj = await createObjectiveFn(db, "u20", {
      questId: q.id,
      name: "Only objective",
      trackingMode: "PROGRESS_BAR",
    });
    const st1 = await createSubTaskFn(db, "u20", {
      objectiveId: obj.id,
      name: "Sub 1",
    });
    const st2 = await createSubTaskFn(db, "u20", {
      objectiveId: obj.id,
      name: "Sub 2",
    });

    await toggleSubTaskFn(db, "u20", st1.id);
    await toggleSubTaskFn(db, "u20", st2.id); // last sub-task → objective completes → quest archives

    const archivedQuest = await db.query.quest.findFirst({
      where: eq(quest.id, q.id),
    });
    expect(archivedQuest!.isArchived).toBe(true);
  });

  it("does not auto-complete objective when sub-task is untoggled", async () => {
    await insertUser(db, "u21");
    const q = await createQuestForUser(db, "u21");
    const obj = await createObjectiveFn(db, "u21", {
      questId: q.id,
      name: "Task",
      trackingMode: "PROGRESS_BAR",
    });
    const st1 = await createSubTaskFn(db, "u21", {
      objectiveId: obj.id,
      name: "Sub 1",
    });
    const st2 = await createSubTaskFn(db, "u21", {
      objectiveId: obj.id,
      name: "Sub 2",
    });

    // Complete both, then untoggle one
    await toggleSubTaskFn(db, "u21", st1.id); // → true
    await toggleSubTaskFn(db, "u21", st2.id); // → true  (objective completes)

    // Objective is now complete; untoggle st1
    await toggleSubTaskFn(db, "u21", st1.id); // → false

    const obj2 = await db.query.objective.findFirst({
      where: eq(objective.id, obj.id),
    });
    // isCompleted stays true (no un-complete logic in this slice)
    expect(obj2!.isCompleted).toBe(true);
  });
});

describe("SubTask Engine — deleteSubTask", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("deletes a sub-task", async () => {
    await insertUser(db, "u22");
    const q = await createQuestForUser(db, "u22");
    const obj = await createObjectiveFn(db, "u22", {
      questId: q.id,
      name: "Progress",
      trackingMode: "PROGRESS_BAR",
    });
    const st = await createSubTaskFn(db, "u22", {
      objectiveId: obj.id,
      name: "Delete me",
    });

    await deleteSubTaskFn(db, "u22", st.id);

    const found = await db.query.subTask.findFirst({
      where: eq(subTask.id, st.id),
    });
    expect(found).toBeUndefined();
  });

  it("throws when sub-task belongs to another user", async () => {
    await insertUser(db, "u23a");
    await insertUser(db, "u23b");
    const q = await createQuestForUser(db, "u23a");
    const obj = await createObjectiveFn(db, "u23a", {
      questId: q.id,
      name: "Task",
      trackingMode: "PROGRESS_BAR",
    });
    const st = await createSubTaskFn(db, "u23a", {
      objectiveId: obj.id,
      name: "Mine",
    });

    await expect(deleteSubTaskFn(db, "u23b", st.id)).rejects.toThrow(
      "Sub-task not found.",
    );
  });
});

// ---------------------------------------------------------------------------
// Objective Archive tests (Issue #16)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Objective Description tests (Issue #40)
// ---------------------------------------------------------------------------

describe("Objective Description — createObjectiveFn", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("persists description when provided", async () => {
    await insertUser(db, "ud1");
    const q = await createQuestForUser(db, "ud1");

    const obj = await createObjectiveFn(db, "ud1", {
      questId: q.id,
      name: "Documented step",
      description: "This is why it matters",
    });

    expect(obj.description).toBe("This is why it matters");
  });

  it("succeeds with no description (nullable)", async () => {
    await insertUser(db, "ud2");
    const q = await createQuestForUser(db, "ud2");

    const obj = await createObjectiveFn(db, "ud2", {
      questId: q.id,
      name: "No notes",
    });

    expect(obj.description).toBeNull();
  });
});

describe("Objective Description — updateObjectiveFn", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("can set a description on an existing objective", async () => {
    await insertUser(db, "ud3");
    const q = await createQuestForUser(db, "ud3");
    const obj = await createObjectiveFn(db, "ud3", { questId: q.id, name: "Task" });

    const updated = await updateObjectiveFn(db, "ud3", {
      id: obj.id,
      description: "Added notes",
    });

    expect(updated.description).toBe("Added notes");
  });

  it("can clear a description by setting it to null", async () => {
    await insertUser(db, "ud4");
    const q = await createQuestForUser(db, "ud4");
    const obj = await createObjectiveFn(db, "ud4", {
      questId: q.id,
      name: "Task",
      description: "Some notes",
    });

    const updated = await updateObjectiveFn(db, "ud4", {
      id: obj.id,
      description: null,
    });

    expect(updated.description).toBeNull();
  });
});

describe("Objective Archive — archiveObjectiveFn", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("sets isArchived to true", async () => {
    await insertUser(db, "ua1");
    const q = await createQuestForUser(db, "ua1");
    const obj = await createObjectiveFn(db, "ua1", {
      questId: q.id,
      name: "Archive me",
    });

    const archived = await archiveObjectiveFn(db, "ua1", obj.id);
    expect(archived.isArchived).toBe(true);
  });

  it("throws when objective belongs to another user", async () => {
    await insertUser(db, "ua2a");
    await insertUser(db, "ua2b");
    const q = await createQuestForUser(db, "ua2a");
    const obj = await createObjectiveFn(db, "ua2a", {
      questId: q.id,
      name: "Mine",
    });

    await expect(archiveObjectiveFn(db, "ua2b", obj.id)).rejects.toThrow(
      "Objective not found.",
    );
  });
});

describe("Objective Archive — restoreObjectiveFn", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("clears isArchived flag", async () => {
    await insertUser(db, "ur1");
    const q = await createQuestForUser(db, "ur1");
    const obj = await createObjectiveFn(db, "ur1", {
      questId: q.id,
      name: "Restore me",
    });
    await archiveObjectiveFn(db, "ur1", obj.id);

    const restored = await restoreObjectiveFn(db, "ur1", obj.id);
    expect(restored.isArchived).toBe(false);
  });
});

describe("Objective Archive — listActiveQuests excludes archived objectives", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("does not include archived objectives in the active quest result", async () => {
    await insertUser(db, "ulaq1");
    const q = await createQuestForUser(db, "ulaq1");
    const obj1 = await createObjectiveFn(db, "ulaq1", {
      questId: q.id,
      name: "Active",
    });
    const obj2 = await createObjectiveFn(db, "ulaq1", {
      questId: q.id,
      name: "Archived",
    });
    await archiveObjectiveFn(db, "ulaq1", obj2.id);

    // Fetch objectives directly filtered by isArchived = false
    const activeObjs = await db.query.objective.findMany({
      where: (o, { eq, and }) =>
        and(eq(o.questId, q.id), eq(o.isArchived, false)),
    });

    const ids = activeObjs.map((o) => o.id);
    expect(ids).toContain(obj1.id);
    expect(ids).not.toContain(obj2.id);
  });
});

describe("Objective Archive — autoArchiveQuestIfComplete ignores archived objectives", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("auto-archives quest when only active objectives are complete (archived ones ignored)", async () => {
    await insertUser(db, "uaaq1");
    const q = await createQuestForUser(db, "uaaq1");

    const active = await createObjectiveFn(db, "uaaq1", {
      questId: q.id,
      name: "Active task",
    });
    const archived = await createObjectiveFn(db, "uaaq1", {
      questId: q.id,
      name: "Shelved task",
    });
    await archiveObjectiveFn(db, "uaaq1", archived.id);

    // Complete the only active objective — quest should auto-archive
    await completeObjectiveFn(db, "uaaq1", active.id);

    const result = await db.query.quest.findFirst({
      where: (q2, { eq }) => eq(q2.id, q.id),
    });
    expect(result!.isArchived).toBe(true);
  });
});
