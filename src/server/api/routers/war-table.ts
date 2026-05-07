import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  addToTodayFn,
  removeFromTodayFn,
  getTodayScheduleFn,
  reorderQueueFn,
  getAccumulatedDurationsFn,
} from "~/server/api/routers/war-table-helpers";
import {
  getWeeklyTemplateFn,
  getTodayOverrideFn,
} from "~/server/api/routers/availability-helpers";
import { resolveWindows } from "~/server/availability-window-resolver";
import { dailyScheduleItem, objective, quest } from "~/server/db/schema";

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
   * Items are enriched with objective and quest names.
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

    const scheduled = await getTodayScheduleFn(
      ctx.db,
      userId,
      currentTime,
      windows,
    );

    if (scheduled.length === 0) return [];

    // Enrich with objective and quest names
    const date = currentTime.toISOString().slice(0, 10);
    const rawItems = await ctx.db
      .select({
        id: dailyScheduleItem.id,
        objectiveId: dailyScheduleItem.objectiveId,
        intendedDuration: dailyScheduleItem.intendedDuration,
        order: dailyScheduleItem.order,
        objectiveName: objective.name,
        questId: objective.questId,
        questName: quest.name,
        difficulty: objective.difficulty,
      })
      .from(dailyScheduleItem)
      .innerJoin(objective, eq(dailyScheduleItem.objectiveId, objective.id))
      .innerJoin(quest, eq(objective.questId, quest.id))
      .where(
        and(
          eq(dailyScheduleItem.userId, userId),
          eq(dailyScheduleItem.date, date),
        ),
      )
      .orderBy(asc(dailyScheduleItem.order));

    // Merge scheduledStart values from the scheduler output
    const scheduledMap = new Map(
      scheduled.map((s) => [s.id, s.scheduledStart]),
    );

    // Compute accumulated duration per item from completed work sessions
    const itemIds = rawItems.map((item) => item.id);
    const accumulatedMap = await getAccumulatedDurationsFn(
      ctx.db,
      userId,
      itemIds,
      date,
    );

    return rawItems.map((item) => ({
      ...item,
      scheduledStart: scheduledMap.get(item.id),
      accumulatedDuration: accumulatedMap.get(item.id) ?? 0,
    }));
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
