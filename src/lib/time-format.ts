/**
 * Shared time-formatting utilities (Issue #71).
 *
 * These are pure functions with no side effects so they can be
 * tested in isolation and imported by both server and client code.
 */

/**
 * Convert an HH:MM string (e.g. "13:30") to a locale-aware 12-hour
 * display string (e.g. "1:30 PM").
 *
 * The hour cycle is locked to h12 so the output is always 12-hour
 * regardless of the user's system locale.
 */
export function formatHHMM(hhmm: string): string {
  const [hourStr, minuteStr] = hhmm.split(":");
  const hour = parseInt(hourStr!, 10);
  const minute = parseInt(minuteStr!, 10);

  // Use an arbitrary fixed date; only the time matters.
  const date = new Date(2000, 0, 1, hour, minute, 0);

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    hourCycle: "h12",
  });
}
