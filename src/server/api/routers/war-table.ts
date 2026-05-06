import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  addToTodayFn,
  removeFromTodayFn,
  getTodayScheduleFn,
  reorderQueueFn,
} from "~/server/api/routers/war-table-helpers";
import {
  getWeeklyTemplateFn,
  getTodayOverrideFn,
} from "~/server/api/routers/availability-helpers";
import { resolveWindows } from "~/server/availability-window-resolver";

export const warTableRouter = createTRPCRouter({
  /**
   * Add an objective to today's War Table schedule queue.
   */
  addToToday: protectedProcedure
    .input(
      z.object({
        objectiveId: z.number().int().positive(),
        intendedDuration: z.number().int().positive(), // minutes
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return addToTodayFn(
        ctx.db,
        ctx.session.user.id,
        input.objectiveId,
        input.intendedDuration,
      );
    }),

  /**
   * Remove an objective from today's schedule queue.
   */
  removeFromToday: protectedProcedure
    .input(z.object({ scheduleItemId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      return removeFromTodayFn(
        ctx.db,
        ctx.session.user.id,
        input.scheduleItemId,
      );
    }),

  /**
   * Return today's schedule with scheduledStart computed at read time.
   * scheduledStart is never stored — it is always computed by war-table-scheduler.
   */
  getTodaySchedule: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const currentTime = new Date();

    // Resolve effective windows for today
    const today = currentTime.getDay();
    const templateWindows = await getWeeklyTemplateFn(ctx.db, userId);
    const todayTemplate = templateWindows.filter((w) => w.dayOfWeek === today);
    const overrideWindows = await getTodayOverrideFn(ctx.db, userId);
    const windows = resolveWindows(todayTemplate, overrideWindows);

    return getTodayScheduleFn(ctx.db, userId, currentTime, windows);
  }),

  /**
   * Update the queue order for today's schedule items.
   */
  reorderQueue: protectedProcedure
    .input(z.object({ orderedIds: z.array(z.number().int().positive()) }))
    .mutation(async ({ ctx, input }) => {
      return reorderQueueFn(ctx.db, ctx.session.user.id, input.orderedIds);
    }),
});
