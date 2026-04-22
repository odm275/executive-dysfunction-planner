import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { reward } from "~/server/db/schema";

export const rewardRouter = createTRPCRouter({
  /**
   * Returns all pre-seeded rewards, grouped by category.
   */
  listRewards: protectedProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.select().from(reward);

    const grouped: Record<
      "COMFORT" | "ENTERTAINMENT" | "SOCIAL",
      typeof all
    > = {
      COMFORT: [],
      ENTERTAINMENT: [],
      SOCIAL: [],
    };

    for (const r of all) {
      grouped[r.category].push(r);
    }

    return grouped;
  }),
});
