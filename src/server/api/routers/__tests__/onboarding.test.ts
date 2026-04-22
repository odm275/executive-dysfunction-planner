/**
 * @jest-environment node
 *
 * Tests for the AI Onboarding Conversation (Issue #12).
 * Focuses on:
 * - hasAnyQuests procedure logic
 * - Quest proposal extraction from AI message
 * - Quest/chapter/objective creation from a confirmed proposal
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import path from "path";

import * as schema from "~/server/db/schema";
import { quest, chapter, objective } from "~/server/db/schema";
import {
  createObjectiveFn,
  createChapterFn,
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

// Mirrors the hasAnyQuests logic from the tRPC procedure
async function hasAnyQuests(db: TestDb, userId: string): Promise<boolean> {
  const result = await db
    .select({ id: quest.id })
    .from(quest)
    .where(eq(quest.userId, userId))
    .limit(1);
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// hasAnyQuests
// ---------------------------------------------------------------------------

describe("Onboarding — hasAnyQuests detection", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("returns false for a brand-new user with no quests", async () => {
    await insertUser(db, "new1");
    expect(await hasAnyQuests(db, "new1")).toBe(false);
  });

  it("returns true when user has an active quest", async () => {
    await insertUser(db, "u1");
    await db.insert(quest).values({ userId: "u1", name: "My Quest" });
    expect(await hasAnyQuests(db, "u1")).toBe(true);
  });

  it("returns true when user only has archived quests", async () => {
    await insertUser(db, "u2");
    await db
      .insert(quest)
      .values({ userId: "u2", name: "Old Quest", isArchived: true });
    expect(await hasAnyQuests(db, "u2")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Quest proposal extraction (pure function from OnboardingConversation)
// ---------------------------------------------------------------------------

function extractProposal(content: string) {
  const match = content.match(/```json\s*([\s\S]*?)```/);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]) as {
      questName: string;
      description: string | null;
      isSideQuest: boolean;
      chapters: { name: string }[];
      objectives: {
        name: string;
        difficulty: string;
        chapterName: string | null;
        isDebuffed: boolean;
      }[];
    };
  } catch {
    return null;
  }
}

describe("Onboarding — proposal extraction from AI message", () => {
  it("extracts a valid quest proposal from a JSON code block", () => {
    const aiMessage = `Great, let me structure that for you!

\`\`\`json
{
  "questName": "Driving Lessons",
  "description": "Get my driving licence",
  "isSideQuest": false,
  "chapters": [
    { "name": "Theory" },
    { "name": "Practical" }
  ],
  "objectives": [
    { "name": "Book theory test", "difficulty": "EASY", "chapterName": "Theory", "isDebuffed": false },
    { "name": "Pass theory test", "difficulty": "MEDIUM", "chapterName": "Theory", "isDebuffed": false },
    { "name": "Complete 10 lessons", "difficulty": "HARD", "chapterName": "Practical", "isDebuffed": false }
  ]
}
\`\`\``;

    const proposal = extractProposal(aiMessage);
    expect(proposal).not.toBeNull();
    expect(proposal!.questName).toBe("Driving Lessons");
    expect(proposal!.chapters).toHaveLength(2);
    expect(proposal!.objectives).toHaveLength(3);
    expect(proposal!.objectives[0]!.difficulty).toBe("EASY");
  });

  it("returns null when no JSON block is present", () => {
    const aiMessage = "Tell me more about what's weighing on you.";
    expect(extractProposal(aiMessage)).toBeNull();
  });

  it("returns null when JSON is malformed", () => {
    const aiMessage = "```json\n{ invalid json }\n```";
    expect(extractProposal(aiMessage)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Quest creation from confirmed proposal
// ---------------------------------------------------------------------------

describe("Onboarding — quest creation from confirmed proposal", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("creates a quest with chapters and objectives", async () => {
    await insertUser(db, "oc1");

    // Step 1: create the quest
    const [q] = await db
      .insert(quest)
      .values({ userId: "oc1", name: "Driving Lessons", isSideQuest: false })
      .returning();

    // Step 2: create chapters
    const ch1 = await createChapterFn(db, "oc1", {
      questId: q!.id,
      name: "Theory",
    });
    const ch2 = await createChapterFn(db, "oc1", {
      questId: q!.id,
      name: "Practical",
    });

    // Step 3: create objectives
    const obj1 = await createObjectiveFn(db, "oc1", {
      questId: q!.id,
      chapterId: ch1.id,
      name: "Book theory test",
      difficulty: "EASY",
    });
    const obj2 = await createObjectiveFn(db, "oc1", {
      questId: q!.id,
      chapterId: ch2.id,
      name: "Complete 10 lessons",
      difficulty: "HARD",
    });

    // Verify
    const chapters = await db.query.chapter.findMany({
      where: eq(chapter.questId, q!.id),
    });
    const objectives = await db.query.objective.findMany({
      where: eq(objective.questId, q!.id),
    });

    expect(chapters).toHaveLength(2);
    expect(objectives).toHaveLength(2);
    expect(obj1.chapterId).toBe(ch1.id);
    expect(obj2.chapterId).toBe(ch2.id);
    expect(obj2.difficulty).toBe("HARD");
  });

  it("creates a simple quest with no chapters", async () => {
    await insertUser(db, "oc2");

    const [q] = await db
      .insert(quest)
      .values({ userId: "oc2", name: "Clean flat", isSideQuest: false })
      .returning();

    await createObjectiveFn(db, "oc2", {
      questId: q!.id,
      name: "Do the dishes",
      difficulty: "EASY",
    });

    const chapters = await db.query.chapter.findMany({
      where: eq(chapter.questId, q!.id),
    });
    const objectives = await db.query.objective.findMany({
      where: eq(objective.questId, q!.id),
    });

    expect(chapters).toHaveLength(0);
    expect(objectives).toHaveLength(1);
  });

  it("returning user with existing quests skips onboarding (hasAnyQuests = true)", async () => {
    await insertUser(db, "oc3");
    await db.insert(quest).values({ userId: "oc3", name: "Existing Quest" });

    expect(await hasAnyQuests(db, "oc3")).toBe(true);
  });
});
