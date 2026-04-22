import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  generateInviteToken,
  verifyInviteToken,
  createCollaboratorFn,
  updateContributionFn,
  upgradeToAdventurerFn,
  listCollaboratorsFn,
} from "./collaboration-helpers";

const INVITE_SECRET =
  process.env.INVITE_JWT_SECRET ?? "dev-fallback-invite-secret-change-me!!";

export const collaborationRouter = createTRPCRouter({
  /**
   * Generate a signed invite link token for a recruitable objective.
   * The caller must own the objective's parent quest.
   */
  generateInviteLink: protectedProcedure
    .input(z.object({ objectiveId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify the objective belongs to the caller
      const obj = await ctx.db.query.objective.findFirst({
        where: (o, { eq }) => eq(o.id, input.objectiveId),
        with: { quest: { columns: { userId: true } } },
      });

      if (obj?.quest.userId !== userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Objective not found." });
      }

      if (!obj.isRecruitable) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Objective is not marked as Recruitable.",
        });
      }

      const token = await generateInviteToken(input.objectiveId, INVITE_SECRET);
      return { token };
    }),

  /**
   * Accept an invite token: creates a Collaborator record linking the current
   * user to the objective.
   */
  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const payload = await verifyInviteToken(input.token, INVITE_SECRET);
      if (!payload) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired invite token.",
        });
      }

      try {
        const collab = await createCollaboratorFn(
          ctx.db,
          ctx.session.user.id,
          payload.objectiveId,
        );
        return collab;
      } catch (err) {
        throw new TRPCError({
          code: "CONFLICT",
          message: (err as Error).message,
        });
      }
    }),

  /**
   * Update the current user's contribution to a recruitable objective.
   */
  updateContribution: protectedProcedure
    .input(
      z.object({
        objectiveId: z.number().int(),
        contribution: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateContributionFn(
          ctx.db,
          ctx.session.user.id,
          input.objectiveId,
          input.contribution,
        );
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: (err as Error).message,
        });
      }
    }),

  /**
   * List all collaborators for an objective (adventurer only).
   */
  listCollaborators: protectedProcedure
    .input(z.object({ objectiveId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      try {
        return await listCollaboratorsFn(
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

  /**
   * Upgrade the current user's account tier from PARTY_MEMBER to ADVENTURER.
   */
  upgradeToAdventurer: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      return await upgradeToAdventurerFn(ctx.db, ctx.session.user.id);
    } catch (err) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: (err as Error).message,
      });
    }
  }),
});
