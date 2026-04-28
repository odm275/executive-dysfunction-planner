import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  createChapterFn,
  updateChapterFn,
  deleteChapterFn,
  reorderChaptersFn,
} from "./chapter-objective-helpers";

export const chapterRouter = createTRPCRouter({
  /** Add a chapter to a quest owned by the caller. */
  createChapter: protectedProcedure
    .input(
      z.object({
        questId: z.number().int(),
        name: z.string().min(1).max(255),
        order: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createChapterFn(ctx.db, ctx.session.user.id, input);
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: (err as Error).message,
        });
      }
    }),

  /** Update name or order of an existing chapter. */
  updateChapter: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().min(1).max(255).optional(),
        order: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateChapterFn(ctx.db, ctx.session.user.id, input);
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: (err as Error).message,
        });
      }
    }),

  /** Delete a chapter and all its child objectives (application-layer cascade). */
  deleteChapter: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteChapterFn(ctx.db, ctx.session.user.id, input.id);
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: (err as Error).message,
        });
      }
    }),

  /**
   * Reorder chapters by supplying the full ordered list of chapter IDs.
   * Each ID is assigned its index as the new `order` value.
   */
  reorderChapters: protectedProcedure
    .input(z.object({ orderedIds: z.array(z.number().int()) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await reorderChaptersFn(
          ctx.db,
          ctx.session.user.id,
          input.orderedIds,
        );
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: (err as Error).message,
        });
      }
    }),
});
