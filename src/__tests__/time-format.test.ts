/**
 * Unit tests for the formatHHMM time-formatting utility (Issue #71).
 */
import { formatHHMM } from "~/lib/time-format";

// ---------------------------------------------------------------------------
// Behavior 1 — standard times render in h:mm AM/PM format
// ---------------------------------------------------------------------------
describe("Behavior 1: standard times render in 12-hour AM/PM format", () => {
  it("formats 09:00 as 9:00 AM", () => {
    expect(formatHHMM("09:00")).toBe("9:00 AM");
  });

  it("formats 13:30 as 1:30 PM", () => {
    expect(formatHHMM("13:30")).toBe("1:30 PM");
  });

  it("formats 17:00 as 5:00 PM", () => {
    expect(formatHHMM("17:00")).toBe("5:00 PM");
  });
});

// ---------------------------------------------------------------------------
// Behavior 2 — midnight edge case
// ---------------------------------------------------------------------------
describe("Behavior 2: midnight formats correctly", () => {
  it("formats 00:00 as 12:00 AM", () => {
    expect(formatHHMM("00:00")).toBe("12:00 AM");
  });
});

// ---------------------------------------------------------------------------
// Behavior 3 — noon edge case
// ---------------------------------------------------------------------------
describe("Behavior 3: noon formats correctly", () => {
  it("formats 12:00 as 12:00 PM", () => {
    expect(formatHHMM("12:00")).toBe("12:00 PM");
  });
});
