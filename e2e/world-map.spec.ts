import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "../src/server/db/schema";
import { test, expect } from "./fixtures";
import { TEST_DB, TEST_USER_ID } from "./global-setup";

// Run all tests in this file serially to avoid SQLite write contention
test.describe.configure({ mode: "serial" });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getDb() {
  const client = createClient({ url: `file:${TEST_DB}` });
  return { db: drizzle(client, { schema }), client };
}

async function clearQuestData() {
  const { db, client } = await getDb();
  await db.delete(schema.subTask);
  await db.delete(schema.counterTool);
  await db.delete(schema.objective);
  await db.delete(schema.chapter);
  await db.delete(schema.quest);
  client.close();
}

async function seedEnergyState(value: "LOW" | "MEDIUM" | "HIGH") {
  const { db, client } = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  await db
    .insert(schema.energyState)
    .values({ userId: TEST_USER_ID, value, date: today })
    .onConflictDoUpdate({
      target: [schema.energyState.userId, schema.energyState.date],
      set: { value },
    });
  client.close();
}

async function seedQuest(
  name: string,
  opts: { isSideQuest?: boolean; description?: string } = {},
) {
  const { db, client } = await getDb();
  const [q] = await db
    .insert(schema.quest)
    .values({
      userId: TEST_USER_ID,
      name,
      description: opts.description,
      isSideQuest: opts.isSideQuest ?? false,
    })
    .returning();
  client.close();
  return q!;
}

async function seedObjective(
  questId: number,
  name: string,
  opts: {
    difficulty?: schema.objective["difficulty"];
    isCompleted?: boolean;
    isDebuffed?: boolean;
    trackingMode?: "BINARY" | "PROGRESS_BAR";
    chapterId?: number;
  } = {},
) {
  const { db, client } = await getDb();
  const [o] = await db
    .insert(schema.objective)
    .values({
      questId,
      name,
      difficulty: opts.difficulty ?? "MEDIUM",
      isCompleted: opts.isCompleted ?? false,
      isDebuffed: opts.isDebuffed ?? false,
      trackingMode: opts.trackingMode ?? "BINARY",
      chapterId: opts.chapterId,
    })
    .returning();
  client.close();
  return o!;
}

async function seedChapter(questId: number, name: string, order = 0) {
  const { db, client } = await getDb();
  const [c] = await db
    .insert(schema.chapter)
    .values({ questId, name, order })
    .returning();
  client.close();
  return c!;
}

async function seedCounterTool(objectiveId: number, name: string) {
  const { db, client } = await getDb();
  await db.insert(schema.counterTool).values({ objectiveId, name });
  client.close();
}

async function seedSubTask(
  objectiveId: number,
  name: string,
  isCompleted = false,
) {
  const { db, client } = await getDb();
  await db
    .insert(schema.subTask)
    .values({ objectiveId, name, isCompleted });
  client.close();
}

// ---------------------------------------------------------------------------
// World Map — quest regions
// ---------------------------------------------------------------------------

test.describe("World Map — quest regions", () => {
  test.beforeEach(async () => {
    await clearQuestData();
    await seedEnergyState("MEDIUM");
  });

  test("shows empty state when user has no active quests", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await expect(authedPage.getByText("No active quests yet.")).toBeVisible();
  });

  test("renders quest region for each active quest", async ({ authedPage }) => {
    await seedQuest("Driving Lessons");
    await seedQuest("Wedding Planning");
    await authedPage.goto("/");

    await expect(
      authedPage.getByTestId(/^quest-region-\d+$/),
    ).toHaveCount(2);
    await expect(authedPage.getByText("Driving Lessons")).toBeVisible();
    await expect(authedPage.getByText("Wedding Planning")).toBeVisible();
  });

  test("shows overall progress percentage on quest region", async ({
    authedPage,
  }) => {
    const q = await seedQuest("AI Engineer Course");
    await seedObjective(q.id, "Task A", { isCompleted: true });
    await seedObjective(q.id, "Task B", { isCompleted: false });
    await seedObjective(q.id, "Task C", { isCompleted: false });
    await authedPage.goto("/");

    // 1 of 3 complete = 33%
    await expect(authedPage.getByText("33%")).toBeVisible();
  });

  test("side quest renders with Side Quest badge", async ({ authedPage }) => {
    await seedQuest("World Map Creation", { isSideQuest: true });
    await authedPage.goto("/");

    await expect(authedPage.getByText("Side Quest")).toBeVisible();
  });

  test("suggestion overlay is rendered on the World Map", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    await expect(authedPage.getByTestId("suggestion-overlay")).toBeVisible();
  });

  test("slots-remaining counter reflects quest cap", async ({ authedPage }) => {
    await seedQuest("Quest 1");
    await seedQuest("Quest 2");
    await authedPage.goto("/");

    await expect(authedPage.getByTestId("slots-remaining")).toContainText(
      "4 quest slots remaining",
    );
  });
});

// ---------------------------------------------------------------------------
// Progressive disclosure — expand / collapse
// ---------------------------------------------------------------------------

test.describe("World Map — progressive disclosure", () => {
  test.beforeEach(async () => {
    await clearQuestData();
    await seedEnergyState("HIGH");
  });

  test("quest card is collapsed by default; clicking expands it", async ({
    authedPage,
  }) => {
    const q = await seedQuest("Driving Lessons");
    await seedObjective(q.id, "Book theory test");

    await authedPage.goto("/");

    // Objective not yet visible
    await expect(authedPage.getByText("Book theory test")).not.toBeVisible();

    // Click the quest region to expand
    await authedPage.getByTestId(`quest-region-${q.id}`).click();

    await expect(authedPage.getByText("Book theory test")).toBeVisible();
  });

  test("clicking objective row expands full detail", async ({ authedPage }) => {
    const q = await seedQuest("Driving Lessons");
    const o = await seedObjective(q.id, "Book theory test", {
      difficulty: "HARD",
    });

    await authedPage.goto("/");
    await authedPage.getByTestId(`quest-region-${q.id}`).click();
    await authedPage.getByTestId(`objective-row-${o.id}`).click();

    // Full detail visible
    await expect(
      authedPage.getByTestId(`objective-detail-${o.id}`),
    ).toBeVisible();
    // Difficulty badge shown in the detail panel
    await expect(
      authedPage.getByTestId(`objective-detail-${o.id}`).getByText("Hard"),
    ).toBeVisible();
    // Mode shown
    await expect(authedPage.getByText(/Mode: Binary/)).toBeVisible();
  });

  test("counter-tools appear in objective detail for debuffed objective", async ({
    authedPage,
  }) => {
    const q = await seedQuest("Wedding Planning");
    const o = await seedObjective(q.id, "Call venue", { isDebuffed: true });
    await seedCounterTool(o.id, "Do this with partner");
    await seedCounterTool(o.id, "15-min timer only");

    await authedPage.goto("/");
    await authedPage.getByTestId(`quest-region-${q.id}`).click();
    await authedPage.getByTestId(`objective-row-${o.id}`).click();

    await expect(authedPage.getByText("Counter-tools")).toBeVisible();
    await expect(authedPage.getByText("Do this with partner")).toBeVisible();
    await expect(authedPage.getByText("15-min timer only")).toBeVisible();
  });

  test("progress bar objective shows sub-tasks in detail", async ({
    authedPage,
  }) => {
    const q = await seedQuest("AI Engineer Course");
    const o = await seedObjective(q.id, "Complete module 1", {
      trackingMode: "PROGRESS_BAR",
    });
    await seedSubTask(o.id, "Watch lectures", true);
    await seedSubTask(o.id, "Do exercises", false);

    await authedPage.goto("/");
    await authedPage.getByTestId(`quest-region-${q.id}`).click();
    await authedPage.getByTestId(`objective-row-${o.id}`).click();

    await expect(authedPage.getByText("Watch lectures")).toBeVisible();
    await expect(authedPage.getByText("Do exercises")).toBeVisible();
  });

  test("chapter is collapsed by default; clicking expands its objectives", async ({
    authedPage,
  }) => {
    const q = await seedQuest("Driving Lessons");
    const ch = await seedChapter(q.id, "Theory", 0);
    await seedObjective(q.id, "Study highway code", { chapterId: ch.id });

    await authedPage.goto("/");
    await authedPage.getByTestId(`quest-region-${q.id}`).click();

    // Chapter visible but objective hidden
    await expect(authedPage.getByText("Theory")).toBeVisible();
    await expect(
      authedPage.getByText("Study highway code"),
    ).not.toBeVisible();

    // Expand chapter
    await authedPage.getByTestId(`chapter-toggle-${ch.id}`).click();
    await expect(authedPage.getByText("Study highway code")).toBeVisible();
  });
});
