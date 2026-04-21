/**
 * @jest-environment node
 *
 * Unit tests for the suggestion algorithm (Issue #8).
 * These tests exercise only the pure rankSuggestions function — no DB, no
 * tRPC, no I/O of any kind.
 */
import {
  rankSuggestions,
  type SuggestionObjective,
} from "~/server/suggestion-engine";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeObj(
  overrides: Partial<SuggestionObjective> & { id: number },
): SuggestionObjective {
  return {
    questId: 1,
    questName: "Test Quest",
    isSideQuest: false,
    name: `Objective ${overrides.id}`,
    difficulty: "MEDIUM",
    isDebuffed: false,
    isCompleted: false,
    counterTools: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rule 1 — completed objectives are excluded
// ---------------------------------------------------------------------------
describe("Rule 1: completed objectives excluded", () => {
  it("excludes completed objectives regardless of energy", () => {
    const objs = [
      makeObj({ id: 1, isCompleted: true }),
      makeObj({ id: 2, isCompleted: false }),
    ];
    const result = rankSuggestions("HIGH", objs);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(2);
  });

  it("returns empty when all objectives are completed", () => {
    const objs = [
      makeObj({ id: 1, isCompleted: true }),
      makeObj({ id: 2, isCompleted: true }),
    ];
    expect(rankSuggestions("HIGH", objs)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule 2 — LOW energy
// ---------------------------------------------------------------------------
describe("Rule 2: LOW energy", () => {
  it("includes only EASY and MEDIUM objectives on LOW energy", () => {
    const objs = [
      makeObj({ id: 1, difficulty: "EASY" }),
      makeObj({ id: 2, difficulty: "MEDIUM" }),
      makeObj({ id: 3, difficulty: "HARD" }),
      makeObj({ id: 4, difficulty: "LEGENDARY" }),
    ];
    const result = rankSuggestions("LOW", objs);
    expect(result.map((o) => o.id)).toEqual([1, 2]);
  });

  it("excludes side quest objectives on LOW energy", () => {
    const objs = [
      makeObj({ id: 1, difficulty: "EASY", isSideQuest: true }),
      makeObj({ id: 2, difficulty: "EASY", isSideQuest: false }),
    ];
    const result = rankSuggestions("LOW", objs);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(2);
  });

  it("excludes side quest MEDIUM objectives on LOW energy", () => {
    const objs = [makeObj({ id: 1, difficulty: "MEDIUM", isSideQuest: true })];
    expect(rankSuggestions("LOW", objs)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule 3 — MEDIUM energy
// ---------------------------------------------------------------------------
describe("Rule 3: MEDIUM energy", () => {
  it("includes EASY, MEDIUM, and HARD but not LEGENDARY on MEDIUM energy", () => {
    const objs = [
      makeObj({ id: 1, difficulty: "EASY" }),
      makeObj({ id: 2, difficulty: "MEDIUM" }),
      makeObj({ id: 3, difficulty: "HARD" }),
      makeObj({ id: 4, difficulty: "LEGENDARY" }),
    ];
    const result = rankSuggestions("MEDIUM", objs);
    expect(result.map((o) => o.id)).toEqual([1, 2, 3]);
  });

  it("includes side quest objectives on MEDIUM energy", () => {
    const objs = [
      makeObj({ id: 1, difficulty: "EASY", isSideQuest: true }),
      makeObj({ id: 2, difficulty: "MEDIUM", isSideQuest: true }),
    ];
    const result = rankSuggestions("MEDIUM", objs);
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Rule 4 — HIGH energy
// ---------------------------------------------------------------------------
describe("Rule 4: HIGH energy", () => {
  it("includes all difficulties on HIGH energy", () => {
    const objs = [
      makeObj({ id: 1, difficulty: "EASY" }),
      makeObj({ id: 2, difficulty: "MEDIUM" }),
      makeObj({ id: 3, difficulty: "HARD" }),
      makeObj({ id: 4, difficulty: "LEGENDARY" }),
    ];
    const result = rankSuggestions("HIGH", objs);
    expect(result).toHaveLength(3); // capped at 3
  });

  it("includes side quest objectives on HIGH energy", () => {
    const objs = [makeObj({ id: 1, difficulty: "EASY", isSideQuest: true })];
    expect(rankSuggestions("HIGH", objs)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Rule 5 — Emotionally Charged LEGENDARY deprioritisation
// ---------------------------------------------------------------------------
describe("Rule 5: EC LEGENDARY deprioritised", () => {
  it("puts EC LEGENDARY after other eligible objectives", () => {
    const objs = [
      makeObj({ id: 1, difficulty: "LEGENDARY", isDebuffed: true }),
      makeObj({ id: 2, difficulty: "EASY" }),
      makeObj({ id: 3, difficulty: "MEDIUM" }),
    ];
    const result = rankSuggestions("HIGH", objs);
    // id=2 and id=3 come first, id=1 (EC LEGENDARY) last
    expect(result.map((o) => o.id)).toEqual([2, 3, 1]);
  });

  it("non-EC LEGENDARY is not deprioritised", () => {
    const objs = [
      makeObj({ id: 1, difficulty: "LEGENDARY", isDebuffed: false }),
      makeObj({ id: 2, difficulty: "EASY" }),
    ];
    const result = rankSuggestions("HIGH", objs);
    // LEGENDARY (non-EC) stays in original order
    expect(result.map((o) => o.id)).toEqual([1, 2]);
  });

  it("EC LEGENDARY appears when it is the only eligible objective", () => {
    const objs = [
      makeObj({ id: 1, difficulty: "LEGENDARY", isDebuffed: true }),
    ];
    const result = rankSuggestions("HIGH", objs);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(1);
  });

  it("EC LEGENDARY is excluded on MEDIUM energy (LEGENDARY filter takes precedence)", () => {
    const objs = [
      makeObj({ id: 1, difficulty: "LEGENDARY", isDebuffed: true }),
      makeObj({ id: 2, difficulty: "MEDIUM" }),
    ];
    const result = rankSuggestions("MEDIUM", objs);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Cap at 3 suggestions
// ---------------------------------------------------------------------------
describe("Cap at 3 suggestions", () => {
  it("returns at most 3 suggestions", () => {
    const objs = Array.from({ length: 10 }, (_, i) =>
      makeObj({ id: i + 1, difficulty: "EASY" }),
    );
    expect(rankSuggestions("LOW", objs)).toHaveLength(3);
  });

  it("returns fewer than 3 when not enough eligible objectives", () => {
    const objs = [makeObj({ id: 1, difficulty: "EASY" })];
    expect(rankSuggestions("HIGH", objs)).toHaveLength(1);
  });

  it("returns empty list when no objectives provided", () => {
    expect(rankSuggestions("HIGH", [])).toHaveLength(0);
  });
});
