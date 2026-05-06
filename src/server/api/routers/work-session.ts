import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  startSessionFn,
  pauseSessionFn,
  completeSessionFn,
  getActiveSessionFn,
} from "~/server/api/routers/work-session-helpers";

export const workSessionRouter = createTRPCRouter({
  /**
   * Start a new work session for a schedule item.
   * Only one active session is allowed at a time per user.
   */
  startSession: protectedProcedure
    .input(
      z.object({
        scheduleItemId: z.number().int().positive(),
        objectiveId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return startSessionFn(
        ctx.db,
        ctx.session.user.id,
        input.scheduleItemId,
        input.objectiveId,
      );
    }),

  /**
   * Pause an active session. The session remains open (no endedAt set).
   */
  pauseSession: protectedProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      return pauseSessionFn(ctx.db, ctx.session.user.id, input.sessionId);
    }),

  /**
   * Complete a work session: records endedAt and computes actualDuration.
   */
  completeSession: protectedProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      return completeSessionFn(ctx.db, ctx.session.user.id, input.sessionId);
    }),

  /**
   * Return the currently active (not ended) work session for the user, or null.
   */
  getActiveSession: protectedProcedure.query(async ({ ctx }) => {
    return getActiveSessionFn(ctx.db, ctx.session.user.id);
  }),
});
