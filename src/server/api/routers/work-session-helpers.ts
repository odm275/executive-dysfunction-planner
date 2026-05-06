/**
 * Pure helper functions for the workSession tRPC router (Issue #63).
 *
 * These are extracted from the router so they can be tested in isolation
 * with an in-memory database without importing the tRPC / better-auth stack.
 */
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { TRPCError } from "@trpc/server";

import * as schema from "~/server/db/schema";
import { workSession } from "~/server/db/schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

/** Returns today's date as YYYY-MM-DD in UTC. */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Start a new work session for a schedule item.
 * Enforces the one-active-session-at-a-time constraint.
 */
export async function startSessionFn(
  db: Db,
  userId: string,
  scheduleItemId: number,
  objectiveId: number,
) {
  // Enforce: only one active session at a time
  const active = await getActiveSessionFn(db, userId);
  if (active !== null) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "A work session is already active. Complete or pause the current session before starting a new one.",
    });
  }

  const date = todayUTC();
  const [session] = await db
    .insert(workSession)
    .values({
      userId,
      objectiveId,
      scheduleItemId,
      date,
      startedAt: new Date(),
    })
    .returning();

  return session!;
}

/**
 * Pause a work session. The session remains active (endedAt stays null).
 * This is a no-op beyond recording intent; the session still appears in getActiveSession.
 */
export async function pauseSessionFn(
  db: Db,
  userId: string,
  sessionId: number,
) {
  // Pausing does not end the session — it remains active so the user can resume.
  // The paused state is implicit (no endedAt set). We just verify the session exists
  // and belongs to this user.
  const existing = await db.query.workSession.findFirst({
    where: and(
      eq(workSession.id, sessionId),
      eq(workSession.userId, userId),
      isNull(workSession.endedAt),
    ),
  });

  if (!existing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Active work session not found.",
    });
  }

  return existing;
}

/**
 * Complete a work session: sets endedAt and computes actualDuration.
 * The session is no longer returned by getActiveSession after this call.
 */
export async function completeSessionFn(
  db: Db,
  userId: string,
  sessionId: number,
) {
  const existing = await db.query.workSession.findFirst({
    where: and(
      eq(workSession.id, sessionId),
      eq(workSession.userId, userId),
      isNull(workSession.endedAt),
    ),
  });

  if (!existing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Active work session not found.",
    });
  }

  const endedAt = new Date();
  const actualDuration = Math.round(
    (endedAt.getTime() - existing.startedAt.getTime()) / 60_000,
  );

  const [updated] = await db
    .update(workSession)
    .set({ endedAt, actualDuration })
    .where(eq(workSession.id, sessionId))
    .returning();

  return updated!;
}

/**
 * Return the currently active (not ended) work session for a user, or null.
 */
export async function getActiveSessionFn(db: Db, userId: string) {
  const session = await db.query.workSession.findFirst({
    where: and(eq(workSession.userId, userId), isNull(workSession.endedAt)),
  });

  return session ?? null;
}
