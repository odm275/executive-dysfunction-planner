import { eq } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { user } from "~/server/db/schema";

export const userRouter = createTRPCRouter({
  /**
   * Returns the current user's profile including accountTier.
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const profile = await ctx.db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { id: true, name: true, email: true, accountTier: true },
    });
    if (!profile) throw new Error("User not found.");
    return profile;
  }),
});
