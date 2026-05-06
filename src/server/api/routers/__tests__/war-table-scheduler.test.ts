/**
 * @jest-environment node
 *
 * Unit tests for the war-table-scheduler pure module (Issue #58).
 * No database calls, no I/O — pure function tests.
 */
import {
  scheduleItems,
  type SchedulerItem,
  type SchedulerWindow,
} from "~/server/war-table-scheduler";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeItem(
  overrides: Partial<SchedulerItem> & { id: number },
): SchedulerItem {
  return {
    objectiveId: overrides.id * 10,
    intendedDuration: 60,
    order: overrides.id,
    difficulty: "MEDIUM",
    ...overrides,
  };
}

function makeWindow(startTime: string, endTime: string): SchedulerWindow {
  return { startTime, endTime };
}

/** Build a Date for a given HH:MM on 2024-01-15 (Monday) */
function d(time: string): Date {
  const [h, m] = time.split(":").map(Number);
  return new Date(2024, 0, 15, h!, m!, 0, 0);
}

// ---------------------------------------------------------------------------
// Behavior 1 — Returns empty when queue is empty
// ---------------------------------------------------------------------------
describe("Behavior 1: empty queue", () => {
  it("returns empty array when no items provided", () => {
    const result = scheduleItems(d("09:00"), [makeWindow("09:00", "17:00")], []);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Behavior 2 — Returns empty when no windows available
// ---------------------------------------------------------------------------
describe("Behavior 2: no windows", () => {
  it("returns items without scheduledStart when no windows provided", () => {
    const items = [makeItem({ id: 1 }), makeItem({ id: 2 })];
    const result = scheduleItems(d("09:00"), [], items);
    expect(result).toHaveLength(2);
    expect(result[0]!.scheduledStart).toBeUndefined();
    expect(result[1]!.scheduledStart).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Behavior 3 — Assigns scheduledStart to first item at window start
// ---------------------------------------------------------------------------
describe("Behavior 3: fresh start", () => {
  it("assigns scheduledStart equal to window startTime when currentTime is before window", () => {
    const items = [makeItem({ id: 1, intendedDuration: 60 })];
    const result = scheduleItems(
      d("08:00"), // before the window
      [makeWindow("09:00", "17:00")],
      items,
    );
    expect(result[0]!.scheduledStart).toEqual(d("09:00"));
  });
});

// ---------------------------------------------------------------------------
// Behavior 4 — Assigns scheduledStart from currentTime when mid-window
// ---------------------------------------------------------------------------
describe("Behavior 4: mid-window start", () => {
  it("assigns scheduledStart at currentTime when already inside a window", () => {
    const items = [makeItem({ id: 1, intendedDuration: 30 })];
    const result = scheduleItems(
      d("10:30"), // mid-window
      [makeWindow("09:00", "17:00")],
      items,
    );
    expect(result[0]!.scheduledStart).toEqual(d("10:30"));
  });
});

// ---------------------------------------------------------------------------
// Behavior 5 — Items that exceed a window's remaining time spill to next window
// ---------------------------------------------------------------------------
describe("Behavior 5: window spill", () => {
  it("spills item to next window when it exceeds remaining time in current window", () => {
    // Window 1: 09:00–09:30 (30 min), Window 2: 10:00–12:00 (120 min)
    // currentTime: 09:00
    // item 1: 30 min → fits in window 1 (09:00–09:30), ends exactly at 09:30
    // item 2: 60 min → window 1 exhausted, goes to window 2 at 10:00
    const items = [
      makeItem({ id: 1, intendedDuration: 30 }),
      makeItem({ id: 2, intendedDuration: 60 }),
    ];
    const result = scheduleItems(
      d("09:00"),
      [makeWindow("09:00", "09:30"), makeWindow("10:00", "12:00")],
      items,
    );
    expect(result[0]!.scheduledStart).toEqual(d("09:00"));
    expect(result[1]!.scheduledStart).toEqual(d("10:00"));
  });
});

// ---------------------------------------------------------------------------
// Behavior 6 — Items that exceed all remaining windows have no scheduledStart
// ---------------------------------------------------------------------------
describe("Behavior 6: unscheduled overflow", () => {
  it("returns items without scheduledStart when they exceed all remaining windows", () => {
    // Window: 09:00–09:30 (30 min), currentTime: 09:00
    // item 1: 30 min → fits (09:00)
    // item 2: 60 min → no remaining window → no scheduledStart
    const items = [
      makeItem({ id: 1, intendedDuration: 30 }),
      makeItem({ id: 2, intendedDuration: 60 }),
    ];
    const result = scheduleItems(
      d("09:00"),
      [makeWindow("09:00", "09:30")],
      items,
    );
    expect(result[0]!.scheduledStart).toEqual(d("09:00"));
    expect(result[1]!.scheduledStart).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Behavior 7 — Multiple windows in a day are chained correctly
// ---------------------------------------------------------------------------
describe("Behavior 7: multiple windows chained", () => {
  it("chains consecutive items across multiple windows in correct order", () => {
    // Window 1: 09:00–10:00 (60 min), Window 2: 14:00–16:00 (120 min)
    // currentTime: 09:00
    // item 1: 60 min → window 1, 09:00
    // item 2: 60 min → window 2, 14:00
    // item 3: 60 min → window 2, 15:00
    const items = [
      makeItem({ id: 1, intendedDuration: 60 }),
      makeItem({ id: 2, intendedDuration: 60 }),
      makeItem({ id: 3, intendedDuration: 60 }),
    ];
    const result = scheduleItems(
      d("09:00"),
      [makeWindow("09:00", "10:00"), makeWindow("14:00", "16:00")],
      items,
    );
    expect(result[0]!.scheduledStart).toEqual(d("09:00"));
    expect(result[1]!.scheduledStart).toEqual(d("14:00"));
    expect(result[2]!.scheduledStart).toEqual(d("15:00"));
  });
});

// ---------------------------------------------------------------------------
// Behavior 8 — Priority ordering: lower-difficulty items first on LOW energy
// ---------------------------------------------------------------------------
describe("Behavior 8: priority ordering on LOW energy", () => {
  it("schedules lower-difficulty items before harder ones on LOW energy", () => {
    const items = [
      makeItem({ id: 1, difficulty: "LEGENDARY", order: 1 }),
      makeItem({ id: 2, difficulty: "EASY", order: 2 }),
    ];
    const result = scheduleItems(
      d("09:00"),
      [makeWindow("09:00", "17:00")],
      items,
      "LOW",
    );
    // EASY item (id=2) should be scheduled first despite having higher order
    expect(result[0]!.id).toBe(2);
    expect(result[1]!.id).toBe(1);
    expect(result[0]!.scheduledStart).toEqual(d("09:00"));
    expect(result[1]!.scheduledStart).toEqual(d("10:00"));
  });

  it("preserves queue order when energy is not LOW", () => {
    const items = [
      makeItem({ id: 1, difficulty: "LEGENDARY", order: 1 }),
      makeItem({ id: 2, difficulty: "EASY", order: 2 }),
    ];
    const result = scheduleItems(
      d("09:00"),
      [makeWindow("09:00", "17:00")],
      items,
      "HIGH",
    );
    // Original order preserved
    expect(result[0]!.id).toBe(1);
    expect(result[1]!.id).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Behavior 9 — Recalculation from mid-day produces forward-only schedule
// ---------------------------------------------------------------------------
describe("Behavior 9: mid-day recalculation", () => {
  it("produces a forward-only schedule from currentTime, ignoring past windows", () => {
    // Window: 09:00–11:00 — but currentTime is 12:00 (window already passed)
    const items = [makeItem({ id: 1, intendedDuration: 60 })];
    const result = scheduleItems(
      d("12:00"),
      [makeWindow("09:00", "11:00")],
      items,
    );
    // Window is entirely in the past — item should be unscheduled
    expect(result[0]!.scheduledStart).toBeUndefined();
  });

  it("starts from currentTime even when partially through a window", () => {
    // Window 09:00–17:00, currentTime 15:00
    // item 1: 30 min → scheduledStart at 15:00
    // item 2: 30 min → scheduledStart at 15:30
    const items = [
      makeItem({ id: 1, intendedDuration: 30 }),
      makeItem({ id: 2, intendedDuration: 30 }),
    ];
    const result = scheduleItems(
      d("15:00"),
      [makeWindow("09:00", "17:00")],
      items,
    );
    expect(result[0]!.scheduledStart).toEqual(d("15:00"));
    expect(result[1]!.scheduledStart).toEqual(d("15:30"));
  });
});
