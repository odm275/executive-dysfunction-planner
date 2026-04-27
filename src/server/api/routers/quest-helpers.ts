/**
 * Pure helpers for the Quest Engine that can be imported by tests without
 * pulling in the tRPC / better-auth stack.
 */
import { eq, and } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "~/server/db/schema";
import { quest, objective } from "~/server/db/schema";

export const MAX_ACTIVE_QUESTS = 6;

/** Minimal DB type accepted by the helpers. */
export type QuestDb = LibSQLDatabase<typeof schema>;

/**
 * Archives a quest by setting isArchived = true.
 * Verifies ownership; throws if the quest does not belong to userId.
 */
export async function archiveQuestFn(
  db: QuestDb,
  userId: string,
  questId: number,
): Promise<void> {
  const existing = await db.query.quest.findFirst({
    where: and(eq(quest.id, questId), eq(quest.userId, userId)),
    columns: { id: true },
  });
  if (!existing) throw new Error("Quest not found.");

  await db
    .update(quest)
    .set({ isArchived: true })
    .where(and(eq(quest.id, questId), eq(quest.userId, userId)));
}

/**
 * Checks whether every *active* (non-archived) objective in the given quest is
 * completed and, if so, flips the quest to isArchived = true.
 *
 * Archived objectives are invisible to this check — a quest whose only
 * remaining objectives are archived still auto-archives when the active ones
 * are all complete.
 *
 * Called after any objective completion to enforce auto-archive.
 *
 * @returns true if the quest was archived, false otherwise.
 */
export async function autoArchiveQuestIfComplete(
  db: QuestDb,
  questId: number,
): Promise<boolean> {
  const activeObjectives = await db.query.objective.findMany({
    where: and(eq(objective.questId, questId), eq(objective.isArchived, false)),
    columns: { isCompleted: true },
  });

  // A quest with no active objectives cannot auto-archive.
  if (activeObjectives.length === 0) return false;

  const allComplete = activeObjectives.every((o) => o.isCompleted);
  if (!allComplete) return false;

  await db
    .update(quest)
    .set({ isArchived: true })
    .where(eq(quest.id, questId));

  return true;
}
