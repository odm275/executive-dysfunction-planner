/**
 * Unit tests for DurationPicker validation logic (Issue #72).
 */
import { parseDurationInput } from "~/lib/duration-picker-utils";

// ---------------------------------------------------------------------------
// Behavior 1 — valid positive integers are accepted
// ---------------------------------------------------------------------------
describe("Behavior 1: valid positive integers are accepted", () => {
  it("accepts 30", () => {
    expect(parseDurationInput("30")).toBe(30);
  });

  it("accepts 60", () => {
    expect(parseDurationInput("60")).toBe(60);
  });

  it("accepts 1", () => {
    expect(parseDurationInput("1")).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Behavior 2 — zero and negative values are rejected
// ---------------------------------------------------------------------------
describe("Behavior 2: zero and negative values return null", () => {
  it("rejects 0", () => {
    expect(parseDurationInput("0")).toBeNull();
  });

  it("rejects -1", () => {
    expect(parseDurationInput("-1")).toBeNull();
  });

  it("rejects -60", () => {
    expect(parseDurationInput("-60")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Behavior 3 — non-numeric and empty inputs return null
// ---------------------------------------------------------------------------
describe("Behavior 3: non-numeric and empty inputs return null", () => {
  it("rejects empty string", () => {
    expect(parseDurationInput("")).toBeNull();
  });

  it("rejects non-numeric string", () => {
    expect(parseDurationInput("abc")).toBeNull();
  });

  it("rejects mixed string", () => {
    expect(parseDurationInput("30min")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Behavior 4 — non-integer values return null
// ---------------------------------------------------------------------------
describe("Behavior 4: non-integer values return null", () => {
  it("rejects 1.5", () => {
    expect(parseDurationInput("1.5")).toBeNull();
  });

  it("rejects 30.0 (decimal notation)", () => {
    expect(parseDurationInput("30.0")).toBeNull();
  });
});
