import { eq, and } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { quest, energyState } from "~/server/db/schema";
import {
  rankSuggestions,
  type SuggestionObjective,
  type EnergyLevel,
} from "~/server/suggestion-engine";

/** Returns today's date as a YYYY-MM-DD string in UTC. */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export const suggestionRouter = createTRPCRouter({
  /**
   * Return up to 3 ranked objective suggestions for the current user based on
   * their energy state for today.
   *
   * If no energy state is recorded for today, defaults to MEDIUM so the user
   * always gets suggestions (the energy check-in gate in the UI is a separate
   * concern).
   */
  getSuggestions: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // 1. Resolve today's energy level
    const todayEnergy = await ctx.db.query.energyState.findFirst({
      where: and(
        eq(energyState.userId, userId),
        eq(energyState.date, todayUTC()),
      ),
    });
    const energy: EnergyLevel = (todayEnergy?.value ?? "MEDIUM") as EnergyLevel;

    // 2. Fetch all active (non-archived) quests with objectives and counter-tools
    const activeQuests = await ctx.db.query.quest.findMany({
      where: and(eq(quest.userId, userId), eq(quest.isArchived, false)),
      with: {
        objectives: {
          with: { counterTools: true },
        },
      },
    });

    // 3. Flatten quests → objectives into the shape rankSuggestions expects
    const objectives: SuggestionObjective[] = activeQuests.flatMap((q) =>
      q.objectives.map((o) => ({
        id: o.id,
        questId: q.id,
        questName: q.name,
        isSideQuest: q.isSideQuest,
        name: o.name,
        difficulty: o.difficulty as SuggestionObjective["difficulty"],
        isDebuffed: o.isDebuffed,
        isCompleted: o.isCompleted,
        counterTools: o.counterTools.map((ct) => ({
          id: ct.id,
          name: ct.name,
        })),
      })),
    );

    // 4. Run the pure ranking function (no DB calls inside)
    const suggestions = rankSuggestions(energy, objectives);

    return { energy, suggestions };
  }),
});
