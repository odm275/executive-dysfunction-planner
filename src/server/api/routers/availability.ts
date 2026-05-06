import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  getWeeklyTemplateFn,
  setWindowForDayFn,
  getTodayOverrideFn,
  setTodayOverrideFn,
} from "~/server/api/routers/availability-helpers";
import { resolveWindows } from "~/server/availability-window-resolver";

const windowInput = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const availabilityRouter = createTRPCRouter({
  /**
   * Return all weekly template windows for the current user.
   */
  getWeeklyTemplate: protectedProcedure.query(async ({ ctx }) => {
    return getWeeklyTemplateFn(ctx.db, ctx.session.user.id);
  }),

  /**
   * Replace all windows for a given day of week (0 = Sunday, 6 = Saturday).
   * Destructive — existing windows for that day are deleted.
   */
  setWindowForDay: protectedProcedure
    .input(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        windows: z.array(windowInput),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return setWindowForDayFn(
        ctx.db,
        ctx.session.user.id,
        input.dayOfWeek,
        input.windows,
      );
    }),

  /**
   * Return today's override windows, or an empty array if none are set.
   */
  getTodayOverride: protectedProcedure.query(async ({ ctx }) => {
    return getTodayOverrideFn(ctx.db, ctx.session.user.id);
  }),

  /**
   * Replace today's override windows entirely.
   * Also resolves the effective windows using availability-window-resolver
   * and returns them so the caller can react immediately.
   */
  setTodayOverride: protectedProcedure
    .input(z.object({ windows: z.array(windowInput) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await setTodayOverrideFn(ctx.db, userId, input.windows);

      // Resolve effective windows (for the caller to use without a second fetch)
      const templateWindows = await getWeeklyTemplateFn(ctx.db, userId);
      const today = new Date().getDay(); // 0–6
      const todayTemplate = templateWindows.filter(
        (w) => w.dayOfWeek === today,
      );
      const effective = resolveWindows(todayTemplate, input.windows);
      return { effectiveWindows: effective };
    }),
});
