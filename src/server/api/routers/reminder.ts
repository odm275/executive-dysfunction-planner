import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  storePushSubscriptionFn,
  removePushSubscriptionFn,
  getReminderPreferencesFn,
  updateReminderPreferencesFn,
} from "./reminder-helpers";

export const reminderRouter = createTRPCRouter({
  /**
   * Store the browser push subscription for the current user.
   */
  subscribeToPush: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
        p256dh: z.string(),
        auth: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return storePushSubscriptionFn(ctx.db, ctx.session.user.id, input);
    }),

  /**
   * Remove a push subscription (user opt-out or stale 410 cleanup).
   */
  unsubscribeFromPush: protectedProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await removePushSubscriptionFn(ctx.db, input.endpoint);
      return { success: true };
    }),

  /**
   * Get the current user's reminder preferences (creates defaults if absent).
   */
  getReminderPreferences: protectedProcedure.query(async ({ ctx }) => {
    return getReminderPreferencesFn(ctx.db, ctx.session.user.id);
  }),

  /**
   * Update reminder preferences (enabled flag and frequency).
   */
  updateReminderPreferences: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean().optional(),
        frequencyDays: z.number().int().min(1).max(30).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return updateReminderPreferencesFn(ctx.db, ctx.session.user.id, input);
    }),
});
