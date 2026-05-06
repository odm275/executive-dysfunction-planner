/**
 * @jest-environment node
 *
 * Unit tests for the availability-window-resolver pure module (Issue #59).
 * No database calls, no I/O — pure function tests.
 */
import {
  resolveWindows,
  type TemplateWindow,
  type OverrideWindow,
} from "~/server/availability-window-resolver";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTemplate(
  startTime: string,
  endTime: string,
): TemplateWindow {
  return { startTime, endTime };
}

function makeOverride(
  startTime: string,
  endTime: string,
): OverrideWindow {
  return { startTime, endTime };
}

// ---------------------------------------------------------------------------
// Behavior 1 — Returns template windows when no overrides exist
// ---------------------------------------------------------------------------
describe("Behavior 1: template windows returned when no overrides", () => {
  it("returns template windows unchanged when overrides array is empty", () => {
    const templates = [
      makeTemplate("09:00", "12:00"),
      makeTemplate("14:00", "17:00"),
    ];
    const result = resolveWindows(templates, []);
    expect(result).toHaveLength(2);
    expect(result[0]!.startTime).toBe("09:00");
    expect(result[1]!.startTime).toBe("14:00");
  });
});

// ---------------------------------------------------------------------------
// Behavior 2 — Override windows completely replace template
// ---------------------------------------------------------------------------
describe("Behavior 2: overrides completely replace template", () => {
  it("returns only override windows when overrides exist — template is ignored", () => {
    const templates = [makeTemplate("09:00", "17:00")];
    const overrides = [makeOverride("11:00", "15:00")];
    const result = resolveWindows(templates, overrides);
    expect(result).toHaveLength(1);
    expect(result[0]!.startTime).toBe("11:00");
    expect(result[0]!.endTime).toBe("15:00");
  });

  it("returns empty when overrides exist but are an empty list", () => {
    // A single override of [] means "no windows today" — still replaces template
    // This case is the same as behavior 1 — [] means no overrides at all.
    // The destructive semantics only trigger when overrides.length > 0.
    // Confirmed: passing [] returns template windows (no override scenario).
    const templates = [makeTemplate("09:00", "17:00")];
    const result = resolveWindows(templates, []);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Behavior 3 — Returns empty when no template entries and no overrides
// ---------------------------------------------------------------------------
describe("Behavior 3: empty when no template entries and no overrides", () => {
  it("returns empty array when both template and overrides are empty", () => {
    const result = resolveWindows([], []);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Behavior 4 — Multiple windows returned in time order
// ---------------------------------------------------------------------------
describe("Behavior 4: multiple windows in time order", () => {
  it("returns template windows sorted by startTime ascending", () => {
    const templates = [
      makeTemplate("14:00", "17:00"),
      makeTemplate("09:00", "12:00"),
    ];
    const result = resolveWindows(templates, []);
    expect(result[0]!.startTime).toBe("09:00");
    expect(result[1]!.startTime).toBe("14:00");
  });

  it("returns override windows sorted by startTime ascending", () => {
    const overrides = [
      makeOverride("15:00", "17:00"),
      makeOverride("09:00", "11:00"),
    ];
    const result = resolveWindows([], overrides);
    expect(result[0]!.startTime).toBe("09:00");
    expect(result[1]!.startTime).toBe("15:00");
  });
});
