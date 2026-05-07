/**
 * Pure validation utilities for the DurationPicker component (Issue #72).
 *
 * These are side-effect-free functions that can be unit tested in isolation.
 */

/**
 * Parse a raw string from a duration input field into a valid minute count.
 *
 * Returns the parsed positive integer, or null if the input is empty,
 * non-numeric, a decimal, zero, or negative.
 */
export function parseDurationInput(raw: string): number | null {
  if (raw.trim() === "") return null;

  // Must be a plain integer string (no decimal point)
  if (!/^\d+$/.test(raw.trim())) return null;

  const value = parseInt(raw.trim(), 10);
  if (!Number.isFinite(value) || value <= 0) return null;

  return value;
}
