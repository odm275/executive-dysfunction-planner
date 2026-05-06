/**
 * Pure scheduling algorithm for the War Table feature (Issue #58).
 *
 * No database calls live inside this module — all data is passed in as plain
 * objects so the logic is trivially unit-testable.
 *
 * The scheduler greedily fits items into availability windows starting from
 * currentTime. Items that don't fit in any remaining window are returned
 * without a scheduledStart (unscheduled overflow).
 */

export type EnergyLevel = "LOW" | "MEDIUM" | "HIGH";
export type Difficulty = "EASY" | "MEDIUM" | "HARD" | "LEGENDARY";

export type SchedulerWindow = {
  startTime: string; // HH:MM
  endTime: string; // HH:MM
};

export type SchedulerItem = {
  id: number;
  objectiveId: number;
  intendedDuration: number; // minutes
  order: number; // queue position for tie-breaking
  difficulty: Difficulty;
};

export type ScheduledItem = SchedulerItem & {
  scheduledStart?: Date;
};

/** Difficulty rank used for priority sorting (lower = schedule first). */
const DIFFICULTY_RANK: Record<Difficulty, number> = {
  EASY: 0,
  MEDIUM: 1,
  HARD: 2,
  LEGENDARY: 3,
};

/**
 * Parse an HH:MM string into minutes since midnight.
 */
function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Build an absolute Date from a base date and an HH:MM time string.
 * The returned date has the same year/month/day as `base`, with the
 * hours/minutes from `hhmm` and seconds/ms zeroed.
 */
function absoluteTime(base: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    h ?? 0,
    m ?? 0,
    0,
    0,
  );
}

/**
 * Compute minutes elapsed between two Dates (result may be negative).
 */
function minutesBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 60_000;
}

/**
 * Add `minutes` minutes to `date`, returning a new Date.
 */
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/**
 * Given the current time, today's availability windows, a queue of items, and
 * the user's current energy level, return the items with `scheduledStart`
 * values assigned. Items that don't fit in any remaining window are returned
 * without `scheduledStart`.
 *
 * @param currentTime - The effective "now" for scheduling purposes.
 * @param windows     - Today's availability windows (HH:MM start/end strings).
 * @param items       - Ordered queue of items to schedule.
 * @param energy      - User's current energy level (used for priority sort).
 */
export function scheduleItems(
  currentTime: Date,
  windows: SchedulerWindow[],
  items: SchedulerItem[],
  energy: EnergyLevel = "MEDIUM",
): ScheduledItem[] {
  if (items.length === 0) return [];

  // Apply priority ordering: on LOW energy, easier items go first.
  const orderedItems =
    energy === "LOW"
      ? [...items].sort(
          (a, b) =>
            DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] ||
            a.order - b.order,
        )
      : [...items].sort((a, b) => a.order - b.order);

  // Sort windows by their start time so we process them chronologically.
  const sortedWindows = [...windows].sort(
    (a, b) => parseMinutes(a.startTime) - parseMinutes(b.startTime),
  );

  const result: ScheduledItem[] = [];
  let windowIdx = 0;
  // cursor tracks where the next item would start within the current window
  let cursor: Date | null = null;

  // Advance to the first window that overlaps with currentTime
  while (windowIdx < sortedWindows.length) {
    const win = sortedWindows[windowIdx]!;
    const winEnd = absoluteTime(currentTime, win.endTime);
    if (winEnd <= currentTime) {
      // Window entirely in the past — skip it
      windowIdx++;
      continue;
    }
    // Window has remaining time
    const winStart = absoluteTime(currentTime, win.startTime);
    cursor = currentTime > winStart ? currentTime : winStart;
    break;
  }

  for (const item of orderedItems) {
    let scheduled = false;

    while (windowIdx < sortedWindows.length) {
      const win = sortedWindows[windowIdx]!;
      const winEnd = absoluteTime(currentTime, win.endTime);

      // Ensure cursor is initialised for this window
      if (cursor === null) {
        const winStart = absoluteTime(currentTime, win.startTime);
        cursor = currentTime > winStart ? currentTime : winStart;
      }

      // Skip window if cursor is already past or at its end
      if (cursor >= winEnd) {
        windowIdx++;
        cursor = null;
        continue;
      }

      const remainingMinutes = minutesBetween(cursor, winEnd);
      if (item.intendedDuration <= remainingMinutes) {
        // Item fits in this window
        result.push({ ...item, scheduledStart: new Date(cursor) });
        cursor = addMinutes(cursor, item.intendedDuration);
        scheduled = true;
        break;
      } else {
        // Item doesn't fit — move to next window
        windowIdx++;
        cursor = null;
      }
    }

    if (!scheduled) {
      result.push({ ...item, scheduledStart: undefined });
    }
  }

  return result;
}
