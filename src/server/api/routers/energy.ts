import { eq, and } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { energyState } from "~/server/db/schema";

/** Returns today's date as a YYYY-MM-DD string in UTC. */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export const energyRouter = createTRPCRouter({
  /**
   * Set (or update) the current user's energy level for today.
   * Upserts based on (userId, date) unique constraint.
   */
  setEnergy: protectedProcedure
    .input(z.object({ value: z.enum(["LOW", "MEDIUM", "HIGH"]) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const date = todayUTC();

      const existing = await ctx.db.query.energyState.findFirst({
        where: and(
          eq(energyState.userId, userId),
          eq(energyState.date, date),
        ),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(energyState)
          .set({ value: input.value })
          .where(
            and(
              eq(energyState.userId, userId),
              eq(energyState.date, date),
            ),
          )
          .returning();
        return updated!;
      }

      const [created] = await ctx.db
        .insert(energyState)
        .values({ userId, value: input.value, date })
        .returning();
      return created!;
    }),

  /**
   * Return today's energy state for the current user, or null if not yet set.
   */
  getTodayEnergy: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const date = todayUTC();

    const record = await ctx.db.query.energyState.findFirst({
      where: and(
        eq(energyState.userId, userId),
        eq(energyState.date, date),
      ),
    });

    return record ?? null;
  }),
});
