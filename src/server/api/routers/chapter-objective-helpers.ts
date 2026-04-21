/**
 * Pure helpers for the Chapter & Objective Engine (Issue #6).
 * These functions contain all business logic and can be imported by tests
 * without pulling in the tRPC / better-auth stack.
 */
import { eq, and } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "~/server/db/schema";
import { quest, chapter, objective, subTask } from "~/server/db/schema";
import { autoArchiveQuestIfComplete } from "./quest-helpers";

export type ChapterObjectiveDb = LibSQLDatabase<typeof schema>;

// ---------------------------------------------------------------------------
// Authorization helpers
// ---------------------------------------------------------------------------

/** Returns the quest row if it belongs to userId, otherwise null. */
export async function getOwnedQuest(
  db: ChapterObjectiveDb,
  questId: number,
  userId: string,
) {
  return db.query.quest.findFirst({
    where: and(eq(quest.id, questId), eq(quest.userId, userId)),
    columns: { id: true },
  });
}

/** Returns the chapter row if the parent quest belongs to userId, otherwise null. */
export async function getOwnedChapter(
  db: ChapterObjectiveDb,
  chapterId: number,
  userId: string,
) {
  const ch = await db.query.chapter.findFirst({
    where: eq(chapter.id, chapterId),
    with: { quest: { columns: { id: true, userId: true } } },
  });
  if (ch?.quest.userId !== userId) return null;
  return ch;
}

/**
 * Returns the objective row (with quest info) if the parent quest belongs
 * to userId, otherwise null.
 */
export async function getOwnedObjective(
  db: ChapterObjectiveDb,
  objectiveId: number,
  userId: string,
) {
  const obj = await db.query.objective.findFirst({
    where: eq(objective.id, objectiveId),
    with: {
      quest: { columns: { id: true, userId: true } },
    },
  });
  if (obj?.quest.userId !== userId) return null;
  return obj;
}

// ---------------------------------------------------------------------------
// Chapter operations
// ---------------------------------------------------------------------------

export async function createChapterFn(
  db: ChapterObjectiveDb,
  userId: string,
  input: { questId: number; name: string; order?: number },
) {
  const owned = await getOwnedQuest(db, input.questId, userId);
  if (!owned) throw new Error("Quest not found.");

  const [created] = await db
    .insert(chapter)
    .values({
      questId: input.questId,
      name: input.name,
      order: input.order ?? 0,
    })
    .returning();

  return created!;
}

export async function updateChapterFn(
  db: ChapterObjectiveDb,
  userId: string,
  input: { id: number; name?: string; order?: number },
) {
  const owned = await getOwnedChapter(db, input.id, userId);
  if (!owned) throw new Error("Chapter not found.");

  const { id, ...fields } = input;
  const [updated] = await db
    .update(chapter)
    .set(fields)
    .where(eq(chapter.id, id))
    .returning();

  return updated!;
}

export async function deleteChapterFn(
  db: ChapterObjectiveDb,
  userId: string,
  chapterId: number,
) {
  const owned = await getOwnedChapter(db, chapterId, userId);
  if (!owned) throw new Error("Chapter not found.");

  await db.delete(chapter).where(eq(chapter.id, chapterId));
  return { id: chapterId };
}

/**
 * Reorders chapters by assigning each ID its index position (0-based).
 * All IDs must belong to quests owned by the caller.
 */
export async function reorderChaptersFn(
  db: ChapterObjectiveDb,
  userId: string,
  orderedIds: number[],
) {
  for (let i = 0; i < orderedIds.length; i++) {
    const chapterId = orderedIds[i]!;
    const owned = await getOwnedChapter(db, chapterId, userId);
    if (!owned) throw new Error(`Chapter ${chapterId} not found.`);
    await db
      .update(chapter)
      .set({ order: i })
      .where(eq(chapter.id, chapterId));
  }
  return { updated: orderedIds.length };
}

// ---------------------------------------------------------------------------
// Objective operations
// ---------------------------------------------------------------------------

export async function createObjectiveFn(
  db: ChapterObjectiveDb,
  userId: string,
  input: {
    questId: number;
    chapterId?: number;
    name: string;
    trackingMode?: "BINARY" | "PROGRESS_BAR";
    difficulty?: "EASY" | "MEDIUM" | "HARD" | "LEGENDARY";
    isDebuffed?: boolean;
    isRecruitable?: boolean;
    order?: number;
  },
) {
  const owned = await getOwnedQuest(db, input.questId, userId);
  if (!owned) throw new Error("Quest not found.");

  const [created] = await db
    .insert(objective)
    .values({
      questId: input.questId,
      chapterId: input.chapterId,
      name: input.name,
      trackingMode: input.trackingMode ?? "BINARY",
      difficulty: input.difficulty ?? "MEDIUM",
      isDebuffed: input.isDebuffed ?? false,
      isRecruitable: input.isRecruitable ?? false,
      order: input.order ?? 0,
    })
    .returning();

  return created!;
}

export async function updateObjectiveFn(
  db: ChapterObjectiveDb,
  userId: string,
  input: {
    id: number;
    name?: string;
    difficulty?: "EASY" | "MEDIUM" | "HARD" | "LEGENDARY";
    isDebuffed?: boolean;
    isRecruitable?: boolean;
    order?: number;
  },
) {
  const owned = await getOwnedObjective(db, input.id, userId);
  if (!owned) throw new Error("Objective not found.");

  const { id, ...fields } = input;
  const [updated] = await db
    .update(objective)
    .set(fields)
    .where(eq(objective.id, id))
    .returning();

  return updated!;
}

export async function deleteObjectiveFn(
  db: ChapterObjectiveDb,
  userId: string,
  objectiveId: number,
) {
  const owned = await getOwnedObjective(db, objectiveId, userId);
  if (!owned) throw new Error("Objective not found.");

  await db.delete(objective).where(eq(objective.id, objectiveId));
  return { id: objectiveId };
}

/**
 * Marks a BINARY objective as complete and triggers quest auto-archive.
 * Also accepts PROGRESS_BAR objectives (manual completion override).
 */
export async function completeObjectiveFn(
  db: ChapterObjectiveDb,
  userId: string,
  objectiveId: number,
) {
  const owned = await getOwnedObjective(db, objectiveId, userId);
  if (!owned) throw new Error("Objective not found.");

  const [updated] = await db
    .update(objective)
    .set({ isCompleted: true })
    .where(eq(objective.id, objectiveId))
    .returning();

  await autoArchiveQuestIfComplete(db, owned.questId);

  return updated!;
}

// ---------------------------------------------------------------------------
// SubTask operations
// ---------------------------------------------------------------------------

export async function createSubTaskFn(
  db: ChapterObjectiveDb,
  userId: string,
  input: { objectiveId: number; name: string; order?: number },
) {
  const owned = await getOwnedObjective(db, input.objectiveId, userId);
  if (!owned) throw new Error("Objective not found.");

  const [created] = await db
    .insert(subTask)
    .values({
      objectiveId: input.objectiveId,
      name: input.name,
      order: input.order ?? 0,
    })
    .returning();

  return created!;
}

/**
 * Toggles a sub-task's isCompleted flag.
 * When toggled to complete and ALL sub-tasks in a PROGRESS_BAR objective
 * are now complete, auto-completes the objective and triggers quest
 * auto-archive.
 */
export async function toggleSubTaskFn(
  db: ChapterObjectiveDb,
  userId: string,
  subTaskId: number,
) {
  // Fetch sub-task with enough context to verify ownership and check progress
  const st = await db.query.subTask.findFirst({
    where: eq(subTask.id, subTaskId),
    with: {
      objective: {
        columns: {
          id: true,
          questId: true,
          trackingMode: true,
          isCompleted: true,
        },
        with: {
          quest: { columns: { userId: true } },
        },
      },
    },
  });

  if (st?.objective.quest.userId !== userId) {
    throw new Error("Sub-task not found.");
  }

  const newCompleted = !st.isCompleted;

  const [updated] = await db
    .update(subTask)
    .set({ isCompleted: newCompleted })
    .where(eq(subTask.id, subTaskId))
    .returning();

  // Auto-complete the objective when all sub-tasks are done
  if (
    newCompleted &&
    st.objective.trackingMode === "PROGRESS_BAR" &&
    !st.objective.isCompleted
  ) {
    const allSubTasks = await db.query.subTask.findMany({
      where: eq(subTask.objectiveId, st.objective.id),
      columns: { isCompleted: true },
    });

    const allDone = allSubTasks.every((s) => s.isCompleted);
    if (allDone) {
      await db
        .update(objective)
        .set({ isCompleted: true })
        .where(eq(objective.id, st.objective.id));

      await autoArchiveQuestIfComplete(db, st.objective.questId);
    }
  }

  return updated!;
}

export async function deleteSubTaskFn(
  db: ChapterObjectiveDb,
  userId: string,
  subTaskId: number,
) {
  const st = await db.query.subTask.findFirst({
    where: eq(subTask.id, subTaskId),
    with: {
      objective: {
        columns: { id: true },
        with: { quest: { columns: { userId: true } } },
      },
    },
  });

  if (st?.objective.quest.userId !== userId) {
    throw new Error("Sub-task not found.");
  }

  await db.delete(subTask).where(eq(subTask.id, subTaskId));
  return { id: subTaskId };
}
