/**
 * Pure helpers for the Quest Engine that can be imported by tests without
 * pulling in the tRPC / better-auth stack.
 */
import { eq } from "drizzle-orm";
import { type LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "~/server/db/schema";
import { quest, objective } from "~/server/db/schema";

export const MAX_ACTIVE_QUESTS = 6;

/** Minimal DB type accepted by the helpers. */
export type QuestDb = LibSQLDatabase<typeof schema>;

/**
 * Checks whether every objective in the given quest is completed and, if so,
 * flips the quest to isArchived = true.
 *
 * Called after any objective completion to enforce auto-archive.
 *
 * @returns true if the quest was archived, false otherwise.
 */
export async function autoArchiveQuestIfComplete(
  db: QuestDb,
  questId: number,
): Promise<boolean> {
  const objectives = await db.query.objective.findMany({
    where: eq(objective.questId, questId),
    columns: { isCompleted: true },
  });

  // A quest with no objectives cannot auto-archive.
  if (objectives.length === 0) return false;

  const allComplete = objectives.every((o) => o.isCompleted);
  if (!allComplete) return false;

  await db
    .update(quest)
    .set({ isArchived: true })
    .where(eq(quest.id, questId));

  return true;
}
