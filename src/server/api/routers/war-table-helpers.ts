/**
 * Pure helper functions for the warTable tRPC router (Issue #62).
 *
 * These are extracted from the router so they can be tested in isolation
 * with an in-memory database without importing the tRPC / better-auth stack.
 */
import { and, asc, eq, inArray, isNotNull, sum } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "~/server/db/schema";
import { dailyScheduleItem, workSession } from "~/server/db/schema";
import { scheduleItems } from "~/server/war-table-scheduler";
import type { EnergyLevel } from "~/server/war-table-scheduler";

type Db = ReturnType<typeof drizzle<typeof schema>>;

/** Returns a date's YYYY-MM-DD string in local time (UTC). */
function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Add an objective to today's schedule queue.
 */
export async function addToTodayFn(
  db: Db,
  userId: string,
  objectiveId: number,
  intendedDuration: number,
) {
  const date = dateKey(new Date());

  // Determine the next order value
  const existing = await db
    .select()
    .from(dailyScheduleItem)
    .where(and(eq(dailyScheduleItem.userId, userId), eq(dailyScheduleItem.date, date)));

  const nextOrder = existing.length;

  const [item] = await db
    .insert(dailyScheduleItem)
    .values({ userId, objectiveId, date, intendedDuration, order: nextOrder })
    .returning();

  return item!;
}

/**
 * Remove a schedule item from today's queue.
 */
export async function removeFromTodayFn(
  db: Db,
  userId: string,
  scheduleItemId: number,
) {
  await db
    .delete(dailyScheduleItem)
    .where(
      and(
        eq(dailyScheduleItem.id, scheduleItemId),
        eq(dailyScheduleItem.userId, userId),
      ),
    );
}

/**
 * Return today's schedule items with computed scheduledStart values.
 * scheduledStart is never stored — it is always computed at read time.
 */
export async function getTodayScheduleFn(
  db: Db,
  userId: string,
  currentTime: Date,
  windows: { startTime: string; endTime: string }[],
  energy: EnergyLevel = "MEDIUM",
) {
  const date = dateKey(currentTime);

  const items = await db
    .select()
    .from(dailyScheduleItem)
    .where(and(eq(dailyScheduleItem.userId, userId), eq(dailyScheduleItem.date, date)))
    .orderBy(asc(dailyScheduleItem.order));

  if (items.length === 0) return [];

  const schedulerItems = items.map((item) => ({
    id: item.id,
    objectiveId: item.objectiveId,
    intendedDuration: item.intendedDuration,
    order: item.order,
    difficulty: "MEDIUM" as const, // default; callers can pass enriched items
  }));

  return scheduleItems(currentTime, windows, schedulerItems, energy);
}

/**
 * Update the order of today's queue items.
 * `orderedIds` should be the full list of today's schedule item IDs in the desired order.
 */
export async function reorderQueueFn(
  db: Db,
  userId: string,
  orderedIds: number[],
) {
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(dailyScheduleItem)
        .set({ order: index })
        .where(
          and(
            eq(dailyScheduleItem.id, id),
            eq(dailyScheduleItem.userId, userId),
          ),
        ),
    ),
  );
}

/**
 * Return a map of scheduleItemId → total accumulated work (minutes) for the given
 * items on a specific date.
 *
 * Only completed sessions (endedAt IS NOT NULL) are counted.
 * Items with no completed sessions return 0.
 */
export async function getAccumulatedDurationsFn(
  db: Db,
  userId: string,
  scheduleItemIds: number[],
  date: string,
): Promise<Map<number, number>> {
  const result = new Map<number, number>();

  // Pre-fill all ids with 0 so items with no sessions still appear.
  for (const id of scheduleItemIds) {
    result.set(id, 0);
  }

  if (scheduleItemIds.length === 0) return result;

  const rows = await db
    .select({
      scheduleItemId: workSession.scheduleItemId,
      total: sum(workSession.actualDuration),
    })
    .from(workSession)
    .where(
      and(
        eq(workSession.userId, userId),
        eq(workSession.date, date),
        inArray(workSession.scheduleItemId, scheduleItemIds),
        isNotNull(workSession.endedAt),
      ),
    )
    .groupBy(workSession.scheduleItemId);

  for (const row of rows) {
    result.set(row.scheduleItemId, Number(row.total ?? 0));
  }

  return result;
}
