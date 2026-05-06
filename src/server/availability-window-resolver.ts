/**
 * Pure availability window resolver for the War Table feature (Issue #59).
 *
 * No database calls live inside this module — all data is passed in as plain
 * objects so the logic is trivially unit-testable.
 *
 * Override semantics are destructive: if any override windows exist for the
 * date, they completely replace the template windows for that day.
 */

export type TemplateWindow = {
  startTime: string; // HH:MM
  endTime: string; // HH:MM
};

export type OverrideWindow = {
  startTime: string; // HH:MM
  endTime: string; // HH:MM
};

export type EffectiveWindow = {
  startTime: string; // HH:MM
  endTime: string; // HH:MM
};

/**
 * Parse HH:MM into minutes since midnight for sorting purposes.
 */
function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Sort windows by startTime ascending.
 */
function sortByStartTime<T extends { startTime: string }>(windows: T[]): T[] {
  return [...windows].sort(
    (a, b) => parseMinutes(a.startTime) - parseMinutes(b.startTime),
  );
}

/**
 * Resolve the effective availability windows for a specific day.
 *
 * - If override windows exist (length > 0), they fully replace the template.
 * - If no overrides exist, the template windows are returned.
 * - Results are always sorted by startTime ascending.
 *
 * @param templateWindows  - The user's weekly template entries for that day-of-week.
 * @param overrideWindows  - Any daily overrides for that specific date (empty if none).
 * @returns Effective windows to use, sorted by startTime.
 */
export function resolveWindows(
  templateWindows: TemplateWindow[],
  overrideWindows: OverrideWindow[],
): EffectiveWindow[] {
  const source =
    overrideWindows.length > 0 ? overrideWindows : templateWindows;
  return sortByStartTime(source);
}
