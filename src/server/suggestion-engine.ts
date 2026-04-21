/**
 * Pure suggestion algorithm for the Difficulty Engine (Issue #8).
 *
 * No database calls live inside this module — all data is passed in as plain
 * objects so the logic is trivially unit-testable.
 */

export type EnergyLevel = "LOW" | "MEDIUM" | "HIGH";
export type Difficulty = "EASY" | "MEDIUM" | "HARD" | "LEGENDARY";

export type SuggestionObjective = {
  id: number;
  questId: number;
  questName: string;
  isSideQuest: boolean;
  name: string;
  difficulty: Difficulty;
  isDebuffed: boolean;
  isCompleted: boolean;
  counterTools: { id: number; name: string }[];
};

/**
 * Given the user's current energy level and the full set of objectives across
 * all active quests, return an ordered list of up to 3 suggested objectives.
 *
 * Rules applied (in order):
 * 1. Completed objectives are always excluded.
 * 2. LOW energy → only EASY / MEDIUM objectives; Side Quest objectives excluded.
 * 3. MEDIUM energy → EASY / MEDIUM / HARD objectives.
 * 4. HIGH energy → all difficulties.
 * 5. Emotionally Charged LEGENDARY objectives are deprioritised to the end of
 *    the ranked list so the user builds momentum with easier tasks first.
 */
export function rankSuggestions(
  energy: EnergyLevel,
  objectives: SuggestionObjective[],
): SuggestionObjective[] {
  // Rule 1 — exclude completed objectives
  const incomplete = objectives.filter((o) => !o.isCompleted);

  // Rules 2–4 — filter by energy level and side-quest restriction
  const eligible = incomplete.filter((o) => {
    if (energy === "LOW") {
      // Rule 2a: side quest objectives never shown on Low energy days
      if (o.isSideQuest) return false;
      // Rule 2b: only Easy / Medium on Low energy
      return o.difficulty === "EASY" || o.difficulty === "MEDIUM";
    }
    if (energy === "MEDIUM") {
      // Rule 3: EASY / MEDIUM / HARD on Medium energy
      return o.difficulty !== "LEGENDARY";
    }
    // Rule 4: HIGH energy — all difficulties allowed
    return true;
  });

  // Rule 5 — deprioritise Emotionally Charged LEGENDARY objectives
  const regular = eligible.filter(
    (o) => !(o.isDebuffed && o.difficulty === "LEGENDARY"),
  );
  const ecLegendary = eligible.filter(
    (o) => o.isDebuffed && o.difficulty === "LEGENDARY",
  );

  // Return at most 3 suggestions: regular first, EC LEGENDARY at the end
  return [...regular, ...ecLegendary].slice(0, 3);
}
