/**
 * Pure helper functions for the availability tRPC router (Issue #61).
 *
 * These are extracted from the router so they can be tested in isolation
 * with an in-memory database without importing the tRPC / better-auth stack.
 */
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "~/server/db/schema";
import { availabilityWindow, dailyAvailabilityOverride } from "~/server/db/schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

/** Returns today's date as YYYY-MM-DD in UTC. */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Return all weekly template windows for a user across all days of week.
 */
export async function getWeeklyTemplateFn(db: Db, userId: string) {
  return db
    .select()
    .from(availabilityWindow)
    .where(eq(availabilityWindow.userId, userId));
}

/**
 * Replace all weekly template windows for a specific day of week.
 * Existing windows for that day are deleted and replaced with the new set.
 */
export async function setWindowForDayFn(
  db: Db,
  userId: string,
  dayOfWeek: number,
  windows: { startTime: string; endTime: string }[],
) {
  // Delete existing windows for this day
  await db
    .delete(availabilityWindow)
    .where(
      and(
        eq(availabilityWindow.userId, userId),
        eq(availabilityWindow.dayOfWeek, dayOfWeek),
      ),
    );

  if (windows.length === 0) return [];

  const rows = await db
    .insert(availabilityWindow)
    .values(windows.map((w) => ({ userId, dayOfWeek, ...w })))
    .returning();

  return rows;
}

/**
 * Return today's override windows for a user.
 * Returns an empty array if no overrides are set for today.
 */
export async function getTodayOverrideFn(db: Db, userId: string) {
  const date = todayUTC();
  return db
    .select()
    .from(dailyAvailabilityOverride)
    .where(
      and(
        eq(dailyAvailabilityOverride.userId, userId),
        eq(dailyAvailabilityOverride.date, date),
      ),
    );
}

/**
 * Replace today's override windows entirely.
 * Existing overrides for today are deleted and replaced with the new set.
 */
export async function setTodayOverrideFn(
  db: Db,
  userId: string,
  windows: { startTime: string; endTime: string }[],
) {
  const date = todayUTC();

  // Delete existing overrides for today
  await db
    .delete(dailyAvailabilityOverride)
    .where(
      and(
        eq(dailyAvailabilityOverride.userId, userId),
        eq(dailyAvailabilityOverride.date, date),
      ),
    );

  if (windows.length === 0) return [];

  const rows = await db
    .insert(dailyAvailabilityOverride)
    .values(windows.map((w) => ({ userId, date, ...w })))
    .returning();

  return rows;
}
