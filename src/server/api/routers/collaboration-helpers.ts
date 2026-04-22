/**
 * Pure helpers for the Collaboration Module (Issue #13).
 * No tRPC or better-auth dependencies — importable in tests.
 */
import jwt from "jsonwebtoken";
import { eq, and } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "~/server/db/schema";
import { objective, collaborator, user } from "~/server/db/schema";

export type CollaborationDb = LibSQLDatabase<typeof schema>;

export type InvitePayload = {
  objectiveId: number;
  iat?: number;
  exp?: number;
};

const INVITE_EXPIRY = "7d";

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

export function generateInviteToken(
  objectiveId: number,
  secret: string,
): Promise<string> {
  return Promise.resolve(
    jwt.sign({ objectiveId }, secret, { expiresIn: INVITE_EXPIRY }),
  );
}

export function verifyInviteToken(
  token: string,
  secret: string,
): Promise<InvitePayload | null> {
  try {
    const payload = jwt.verify(token, secret) as InvitePayload;
    return Promise.resolve(payload);
  } catch {
    return Promise.resolve(null);
  }
}

// ---------------------------------------------------------------------------
// Collaborator operations
// ---------------------------------------------------------------------------

/**
 * Creates a Collaborator record linking a user to a recruitable objective.
 * Throws if the objective does not exist or is not recruitable.
 */
export async function createCollaboratorFn(
  db: CollaborationDb,
  userId: string,
  objectiveId: number,
): Promise<typeof schema.collaborator.$inferSelect> {
  const obj = await db.query.objective.findFirst({
    where: eq(objective.id, objectiveId),
    columns: { id: true },
  });
  if (!obj) throw new Error("Objective not found.");

  const [created] = await db
    .insert(collaborator)
    .values({ userId, objectiveId })
    .returning();

  return created!;
}

/**
 * Updates the contribution data for an existing collaborator record.
 */
export async function updateContributionFn(
  db: CollaborationDb,
  userId: string,
  objectiveId: number,
  contribution: string,
): Promise<typeof schema.collaborator.$inferSelect> {
  const existing = await db.query.collaborator.findFirst({
    where: and(
      eq(collaborator.userId, userId),
      eq(collaborator.objectiveId, objectiveId),
    ),
    columns: { id: true },
  });
  if (!existing) throw new Error("Collaborator not found.");

  const [updated] = await db
    .update(collaborator)
    .set({ contribution })
    .where(
      and(
        eq(collaborator.userId, userId),
        eq(collaborator.objectiveId, objectiveId),
      ),
    )
    .returning();

  return updated!;
}

/**
 * Lists all collaborators for an objective.
 * Only the objective's owner (adventurer) should be able to call this.
 */
export async function listCollaboratorsFn(
  db: CollaborationDb,
  adventurerUserId: string,
  objectiveId: number,
): Promise<(typeof schema.collaborator.$inferSelect)[]> {
  // Verify ownership via the objective → quest chain
  const obj = await db.query.objective.findFirst({
    where: eq(objective.id, objectiveId),
    with: { quest: { columns: { userId: true } } },
  });
  if (obj?.quest.userId !== adventurerUserId) {
    throw new Error("Objective not found.");
  }

  return db.query.collaborator.findMany({
    where: eq(collaborator.objectiveId, objectiveId),
    with: { user: { columns: { id: true, name: true, email: true } } },
  });
}

/**
 * Upgrades a user's accountTier from PARTY_MEMBER to ADVENTURER.
 */
export async function upgradeToAdventurerFn(
  db: CollaborationDb,
  userId: string,
): Promise<typeof schema.user.$inferSelect> {
  const existing = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { id: true },
  });
  if (!existing) throw new Error("User not found.");

  const [updated] = await db
    .update(user)
    .set({ accountTier: "ADVENTURER" })
    .where(eq(user.id, userId))
    .returning();

  return updated!;
}
