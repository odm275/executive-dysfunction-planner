import { eq, and, count } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { quest } from "~/server/db/schema";
import {
  MAX_ACTIVE_QUESTS,
  autoArchiveQuestIfComplete,
} from "./quest-helpers";

export { MAX_ACTIVE_QUESTS, autoArchiveQuestIfComplete };

export const questRouter = createTRPCRouter({
  /**
   * Create a new quest for the current user.
   * Rejects with PRECONDITION_FAILED if the user already has 6 active quests.
   */
  createQuest: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        isSideQuest: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const result = await ctx.db
        .select({ activeCount: count() })
        .from(quest)
        .where(and(eq(quest.userId, userId), eq(quest.isArchived, false)));

      const activeCount = result[0]?.activeCount ?? 0;

      if (activeCount >= MAX_ACTIVE_QUESTS) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `You already have ${MAX_ACTIVE_QUESTS} active quests. Archive or complete one before adding more.`,
        });
      }

      const [created] = await ctx.db
        .insert(quest)
        .values({
          userId,
          name: input.name,
          description: input.description,
          isSideQuest: input.isSideQuest,
        })
        .returning();

      return created!;
    }),

  /**
   * Update name, description, or isSideQuest flag for an existing quest.
   */
  updateQuest: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        isSideQuest: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { id, ...fields } = input;

      const existing = await ctx.db.query.quest.findFirst({
        where: and(eq(quest.id, id), eq(quest.userId, userId)),
        columns: { id: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quest not found.",
        });
      }

      const [updated] = await ctx.db
        .update(quest)
        .set(fields)
        .where(and(eq(quest.id, id), eq(quest.userId, userId)))
        .returning();

      return updated!;
    }),

  /**
   * Permanently delete a quest (and all its chapters/objectives via cascade).
   */
  deleteQuest: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const existing = await ctx.db.query.quest.findFirst({
        where: and(eq(quest.id, input.id), eq(quest.userId, userId)),
        columns: { id: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quest not found.",
        });
      }

      await ctx.db
        .delete(quest)
        .where(and(eq(quest.id, input.id), eq(quest.userId, userId)));

      return { id: input.id };
    }),

  /**
   * Returns true if the user has any quests (active or archived).
   * Used to detect first-time users for the onboarding flow.
   */
  hasAnyQuests: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const result = await ctx.db
      .select({ id: quest.id })
      .from(quest)
      .where(eq(quest.userId, userId))
      .limit(1);
    return result.length > 0;
  }),

  /**
   * List all non-archived quests for the current user (with chapters and objectives).
   */
  listActiveQuests: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    return ctx.db.query.quest.findMany({
      where: and(eq(quest.userId, userId), eq(quest.isArchived, false)),
      with: {
        chapters: {
          orderBy: (c, { asc }) => [asc(c.order)],
        },
        objectives: {
          where: (o, { eq }) => eq(o.isArchived, false),
          with: {
            subTasks: { orderBy: (s, { asc }) => [asc(s.order)] },
            counterTools: true,
          },
          orderBy: (o, { asc }) => [asc(o.order)],
        },
      },
      orderBy: (q, { desc }) => [desc(q.createdAt)],
    });
  }),

  /**
   * List all archived quests for the current user.
   */
  listArchivedQuests: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    return ctx.db.query.quest.findMany({
      where: and(eq(quest.userId, userId), eq(quest.isArchived, true)),
      orderBy: (q, { desc }) => [desc(q.updatedAt)],
    });
  }),

  /**
   * Get a single quest by ID (must belong to the current user).
   */
  getQuest: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const result = await ctx.db.query.quest.findFirst({
        where: and(eq(quest.id, input.id), eq(quest.userId, userId)),
        with: {
          chapters: {
            orderBy: (c, { asc }) => [asc(c.order)],
          },
          objectives: {
            where: (o, { eq }) => eq(o.isArchived, false),
            with: {
              subTasks: { orderBy: (s, { asc }) => [asc(s.order)] },
              counterTools: true,
            },
            orderBy: (o, { asc }) => [asc(o.order)],
          },
        },
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quest not found.",
        });
      }

      return result;
    }),
});
