/**
 * Pure helpers for the Smart Reminders module (Issue #14).
 * No tRPC or better-auth dependencies — importable in tests.
 */
import { eq, and } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "~/server/db/schema";
import { pushSubscription, reminderPreferences } from "~/server/db/schema";

export type ReminderDb = LibSQLDatabase<typeof schema>;

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type ReminderPreferencesInput = {
  enabled?: boolean;
  frequencyDays?: number;
};

export type ReminderCheckQuest = {
  name: string;
  lastInteractionDaysAgo: number;
  hasHardObjective: boolean;
  hasDebuffedObjective: boolean;
  isSideQuest: boolean;
};

// ---------------------------------------------------------------------------
// Push subscription helpers
// ---------------------------------------------------------------------------

export async function storePushSubscriptionFn(
  db: ReminderDb,
  userId: string,
  input: PushSubscriptionInput,
): Promise<typeof schema.pushSubscription.$inferSelect> {
  // Upsert by endpoint
  await db
    .insert(pushSubscription)
    .values({ userId, ...input })
    .onConflictDoUpdate({
      target: pushSubscription.endpoint,
      set: { p256dh: input.p256dh, auth: input.auth },
    });

  const stored = await db.query.pushSubscription.findFirst({
    where: eq(pushSubscription.endpoint, input.endpoint),
  });

  return stored!;
}

export async function removePushSubscriptionFn(
  db: ReminderDb,
  endpoint: string,
): Promise<void> {
  await db
    .delete(pushSubscription)
    .where(eq(pushSubscription.endpoint, endpoint));
}

export async function getUserPushSubscriptionsFn(
  db: ReminderDb,
  userId: string,
): Promise<(typeof schema.pushSubscription.$inferSelect)[]> {
  return db.query.pushSubscription.findMany({
    where: eq(pushSubscription.userId, userId),
  });
}

// ---------------------------------------------------------------------------
// Reminder preferences helpers
// ---------------------------------------------------------------------------

export async function getReminderPreferencesFn(
  db: ReminderDb,
  userId: string,
): Promise<typeof schema.reminderPreferences.$inferSelect> {
  const existing = await db.query.reminderPreferences.findFirst({
    where: eq(reminderPreferences.userId, userId),
  });

  if (existing) return existing;

  // Create default preferences on first access
  const [created] = await db
    .insert(reminderPreferences)
    .values({ userId })
    .returning();

  return created!;
}

export async function updateReminderPreferencesFn(
  db: ReminderDb,
  userId: string,
  input: ReminderPreferencesInput,
): Promise<typeof schema.reminderPreferences.$inferSelect> {
  // Ensure row exists
  await getReminderPreferencesFn(db, userId);

  const [updated] = await db
    .update(reminderPreferences)
    .set(input)
    .where(eq(reminderPreferences.userId, userId))
    .returning();

  return updated!;
}

// ---------------------------------------------------------------------------
// Reminder condition evaluation (pure logic)
// ---------------------------------------------------------------------------

/**
 * Given a list of quests with their activity state, returns an array of
 * contextual push notification messages.
 *
 * Rules:
 * 1. Side quests are excluded from staleness checks.
 * 2. If a quest hasn't been interacted with in >= frequencyDays, send a
 *    staleness message naming the quest.
 * 3. If a quest has a Hard or debuffed objective (regardless of staleness),
 *    send a flag message.
 * 4. At most one message per quest (staleness takes priority over objective flag).
 */
export function evaluateReminderConditions(
  quests: ReminderCheckQuest[],
  options: { frequencyDays: number },
): string[] {
  const messages: string[] = [];

  for (const q of quests) {
    // Rule 1: skip side quests
    if (q.isSideQuest) continue;

    // Rule 2: staleness check
    if (q.lastInteractionDaysAgo >= options.frequencyDays) {
      messages.push(
        `You haven't touched "${q.name}" in ${q.lastInteractionDaysAgo} day${q.lastInteractionDaysAgo !== 1 ? "s" : ""}. Ready to pick it back up?`,
      );
      continue; // Rule 4: one message per quest
    }

    // Rule 3: Hard or debuffed objective
    if (q.hasHardObjective) {
      messages.push(
        `"${q.name}" has a Hard objective — you'll need energy for it. Plan accordingly.`,
      );
      continue;
    }

    if (q.hasDebuffedObjective) {
      messages.push(
        `"${q.name}" has an Emotionally Charged objective. Take care of yourself first.`,
      );
    }
  }

  return messages;
}
