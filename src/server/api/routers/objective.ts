import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { objective } from "~/server/db/schema";
import {
  createObjectiveFn,
  updateObjectiveFn,
  deleteObjectiveFn,
  completeObjectiveFn,
  createSubTaskFn,
  toggleSubTaskFn,
  deleteSubTaskFn,
  archiveObjectiveFn,
  restoreObjectiveFn,
} from "./chapter-objective-helpers";

const DifficultyEnum = z.enum(["EASY", "MEDIUM", "HARD", "LEGENDARY"]);

export const objectiveRouter = createTRPCRouter({
  /** Create an objective within a quest (optionally under a chapter). */
  createObjective: protectedProcedure
    .input(
      z.object({
        questId: z.number().int(),
        chapterId: z.number().int().optional(),
        name: z.string().min(1).max(255),
        trackingMode: z.enum(["BINARY", "PROGRESS_BAR"]).default("BINARY"),
        difficulty: DifficultyEnum.default("MEDIUM"),
        isDebuffed: z.boolean().default(false),
        isRecruitable: z.boolean().default(false),
        order: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createObjectiveFn(ctx.db, ctx.session.user.id, input);
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: (err as Error).message,
        });
      }
    }),

  /** Update mutable fields on an existing objective. */
  updateObjective: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().min(1).max(255).optional(),
        difficulty: DifficultyEnum.optional(),
        isDebuffed: z.boolean().optional(),
        isRecruitable: z.boolean().optional(),
        order: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateObjectiveFn(ctx.db, ctx.session.user.id, input);
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: (err as Error).message,
        });
      }
    }),

  /** Permanently delete an objective. */
  deleteObjective: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteObjectiveFn(ctx.db, ctx.session.user.id, input.id);
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: (err as Error).message,
        });
      }
    }),

  /**
   * Mark an objective as complete.
   * For BINARY objectives this is the sole completion mechanism.
   * For PROGRESS_BAR objectives this acts as a manual override.
   * Triggers quest auto-archive if this was the last incomplete objective.
   */
  completeObjective: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await completeObjectiveFn(ctx.db, ctx.session.user.id, input.id);
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: (err as Error).message,
        });
      }
    }),

  /** Add a sub-task to a PROGRESS_BAR objective. */
  createSubTask: protectedProcedure
    .input(
      z.object({
        objectiveId: z.number().int(),
        name: z.string().min(1).max(255),
        order: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createSubTaskFn(ctx.db, ctx.session.user.id, input);
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: (err as Error).message,
        });
      }
    }),

  /**
   * Toggle a sub-task's completion state.
   * When all sub-tasks in a PROGRESS_BAR objective are ticked, the objective
   * auto-completes and the quest auto-archives if no other objectives remain.
   */
  toggleSubTask: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await toggleSubTaskFn(ctx.db, ctx.session.user.id, input.id);
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: (err as Error).message,
        });
      }
    }),

  /** Permanently delete a sub-task. */
  deleteSubTask: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteSubTaskFn(ctx.db, ctx.session.user.id, input.id);
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: (err as Error).message,
        });
      }
    }),

  /** Soft-archive an objective (sets isArchived = true). */
  archiveObjective: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await archiveObjectiveFn(ctx.db, ctx.session.user.id, input.id);
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: (err as Error).message,
        });
      }
    }),

  /** Restore a previously archived objective (clears isArchived). */
  restoreObjective: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await restoreObjectiveFn(ctx.db, ctx.session.user.id, input.id);
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: (err as Error).message,
        });
      }
    }),

  /** List archived objectives for a given quest. */
  listArchivedObjectives: protectedProcedure
    .input(z.object({ questId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      // Verify ownership of the quest first
      const owned = await ctx.db.query.quest.findFirst({
        where: (q, { and: a, eq: e }) =>
          a(e(q.id, input.questId), e(q.userId, userId)),
        columns: { id: true },
      });
      if (!owned) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quest not found." });
      }
      return ctx.db.query.objective.findMany({
        where: and(
          eq(objective.questId, input.questId),
          eq(objective.isArchived, true),
        ),
        orderBy: (o, { desc }) => [desc(o.updatedAt)],
      });
    }),
});
