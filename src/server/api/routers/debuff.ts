import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  addCounterToolFn,
  updateCounterToolFn,
  removeCounterToolFn,
  listCounterToolsFn,
} from "./chapter-objective-helpers";

export const debuffRouter = createTRPCRouter({
  /** List all counter-tools for an objective owned by the caller. */
  listCounterTools: protectedProcedure
    .input(z.object({ objectiveId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      try {
        return await listCounterToolsFn(
          ctx.db,
          ctx.session.user.id,
          input.objectiveId,
        );
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: (err as Error).message,
        });
      }
    }),

  /** Add a counter-tool to a debuffed objective. */
  addCounterTool: protectedProcedure
    .input(
      z.object({
        objectiveId: z.number().int(),
        name: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await addCounterToolFn(ctx.db, ctx.session.user.id, input);
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: (err as Error).message,
        });
      }
    }),

  /** Update the text of an existing counter-tool. */
  updateCounterTool: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateCounterToolFn(ctx.db, ctx.session.user.id, input);
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: (err as Error).message,
        });
      }
    }),

  /** Remove a counter-tool permanently. */
  removeCounterTool: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await removeCounterToolFn(
          ctx.db,
          ctx.session.user.id,
          input.id,
        );
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: (err as Error).message,
        });
      }
    }),
});
