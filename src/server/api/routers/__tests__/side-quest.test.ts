/**
 * @jest-environment node
 *
 * Integration tests for Side Quest Support (Issue #10).
 * Verifies:
 * - Side quest objectives cannot have isDebuffed = true (procedure enforcement)
 * - Suggestion engine excludes side quest objectives on LOW energy (already in #8,
 *   re-verified here for completeness)
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "path";

import * as schema from "~/server/db/schema";
import { quest, objective } from "~/server/db/schema";

import {
  createObjectiveFn,
  updateObjectiveFn,
} from "../chapter-objective-helpers";
import {
  rankSuggestions,
  type SuggestionObjective,
} from "~/server/suggestion-engine";

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

async function createSideQuest(db: TestDb, userId: string) {
  const [q] = await db
    .insert(quest)
    .values({ userId, name: "World Map Creation", isSideQuest: true })
    .returning();
  return q!;
}

async function createRegularQuest(db: TestDb, userId: string) {
  const [q] = await db
    .insert(quest)
    .values({ userId, name: "Driving Lessons", isSideQuest: false })
    .returning();
  return q!;
}

function makeSuggestionObj(
  overrides: Partial<SuggestionObjective> & { id: number },
): SuggestionObjective {
  return {
    questId: 1,
    questName: "Test Quest",
    isSideQuest: false,
    name: `Objective ${overrides.id}`,
    difficulty: "EASY",
    isDebuffed: false,
    isCompleted: false,
    counterTools: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Side Quest — no debuff on create
// ---------------------------------------------------------------------------

describe("Side Quest — createObjective rejects isDebuffed", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("throws when creating a debuffed objective inside a side quest", async () => {
    await insertUser(db, "sq1");
    const sq = await createSideQuest(db, "sq1");

    await expect(
      createObjectiveFn(db, "sq1", {
        questId: sq.id,
        name: "Shouldn't be emotionally charged",
        isDebuffed: true,
      }),
    ).rejects.toThrow("Side Quest objectives cannot be Emotionally Charged.");
  });

  it("allows creating a non-debuffed objective inside a side quest", async () => {
    await insertUser(db, "sq2");
    const sq = await createSideQuest(db, "sq2");

    const obj = await createObjectiveFn(db, "sq2", {
      questId: sq.id,
      name: "Fun task",
      isDebuffed: false,
    });

    expect(obj.isDebuffed).toBe(false);
  });

  it("allows creating a debuffed objective in a regular quest", async () => {
    await insertUser(db, "sq3");
    const q = await createRegularQuest(db, "sq3");

    const obj = await createObjectiveFn(db, "sq3", {
      questId: q.id,
      name: "Hard emotional task",
      isDebuffed: true,
    });

    expect(obj.isDebuffed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Side Quest — no debuff on update
// ---------------------------------------------------------------------------

describe("Side Quest — updateObjective rejects isDebuffed", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("throws when setting isDebuffed on an objective inside a side quest", async () => {
    await insertUser(db, "sq4");
    const sq = await createSideQuest(db, "sq4");

    const obj = await createObjectiveFn(db, "sq4", {
      questId: sq.id,
      name: "Fun task",
      isDebuffed: false,
    });

    await expect(
      updateObjectiveFn(db, "sq4", { id: obj.id, isDebuffed: true }),
    ).rejects.toThrow("Side Quest objectives cannot be Emotionally Charged.");
  });

  it("allows setting isDebuffed = false on a side quest objective (no-op)", async () => {
    await insertUser(db, "sq5");
    const sq = await createSideQuest(db, "sq5");

    const obj = await createObjectiveFn(db, "sq5", {
      questId: sq.id,
      name: "Fun task",
      isDebuffed: false,
    });

    const updated = await updateObjectiveFn(db, "sq5", {
      id: obj.id,
      isDebuffed: false,
    });

    expect(updated.isDebuffed).toBe(false);
  });

  it("allows updating other fields on a side quest objective", async () => {
    await insertUser(db, "sq6");
    const sq = await createSideQuest(db, "sq6");

    const obj = await createObjectiveFn(db, "sq6", {
      questId: sq.id,
      name: "Old name",
    });

    const updated = await updateObjectiveFn(db, "sq6", {
      id: obj.id,
      name: "New name",
      difficulty: "HARD",
    });

    expect(updated.name).toBe("New name");
    expect(updated.difficulty).toBe("HARD");
  });
});

// ---------------------------------------------------------------------------
// Suggestion engine — side quest objectives excluded on LOW energy
// ---------------------------------------------------------------------------

describe("Suggestion engine — side quest objectives excluded on LOW energy", () => {
  it("excludes side quest objectives from LOW energy suggestions", () => {
    const objs = [
      makeSuggestionObj({ id: 1, isSideQuest: true, difficulty: "EASY" }),
      makeSuggestionObj({ id: 2, isSideQuest: false, difficulty: "EASY" }),
    ];

    const result = rankSuggestions("LOW", objs);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(2);
  });

  it("includes side quest EASY objectives on MEDIUM energy", () => {
    const objs = [
      makeSuggestionObj({ id: 1, isSideQuest: true, difficulty: "EASY" }),
      makeSuggestionObj({ id: 2, isSideQuest: false, difficulty: "EASY" }),
    ];

    const result = rankSuggestions("MEDIUM", objs);
    expect(result).toHaveLength(2);
  });

  it("includes side quest objectives on HIGH energy", () => {
    const objs = [
      makeSuggestionObj({ id: 1, isSideQuest: true, difficulty: "LEGENDARY" }),
      makeSuggestionObj({ id: 2, isSideQuest: false, difficulty: "EASY" }),
    ];

    const result = rankSuggestions("HIGH", objs);
    expect(result).toHaveLength(2);
  });
});
