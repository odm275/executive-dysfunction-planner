import { type NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { eq, and } from "drizzle-orm";

import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { quest, objective, pushSubscription } from "~/server/db/schema";
import {
  evaluateReminderConditions,
  removePushSubscriptionFn,
  type ReminderCheckQuest,
} from "~/server/api/routers/reminder-helpers";

export const runtime = "nodejs";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

// Only configure web-push if keys are available
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

/**
 * GET /api/cron/send-reminders
 *
 * Called by Vercel Cron (or any scheduler) periodically.
 * Evaluates reminder conditions per user and sends Web Push messages.
 */
export async function GET(req: NextRequest) {
  // Basic security: verify the cron secret header (Vercel sets this automatically)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({
      ok: false,
      message: "VAPID keys not configured — skipping reminder dispatch",
    });
  }

  // Load all users who have push subscriptions and reminders enabled
  const usersWithSubs = await db.query.pushSubscription.findMany({
    with: {
      user: {
        columns: { id: true },
        with: {
          reminderPreferences: true,
          quests: {
            where: (q, { eq }) => eq(q.isArchived, false),
            with: {
              objectives: {
                columns: {
                  id: true,
                  difficulty: true,
                  isDebuffed: true,
                  isCompleted: true,
                  updatedAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  let sent = 0;
  let removed = 0;

  for (const sub of usersWithSubs) {
    const userRecord = sub.user as typeof sub.user & {
      reminderPreferences: typeof schema.reminderPreferences.$inferSelect | null;
      quests: (typeof schema.quest.$inferSelect & {
        objectives: (typeof schema.objective.$inferSelect)[];
      })[];
    };

    // Check if reminders are enabled for this user
    const prefs = userRecord.reminderPreferences;
    if (prefs && !prefs.enabled) continue;
    const frequencyDays = prefs?.frequencyDays ?? 3;

    // Build ReminderCheckQuest list
    const now = Date.now();
    const msPerDay = 86_400_000;

    const reminderQuests: ReminderCheckQuest[] = userRecord.quests.map((q) => {
      const latestActivity = q.objectives.reduce((max, o) => {
        const ts = o.updatedAt ? new Date(o.updatedAt).getTime() : 0;
        return ts > max ? ts : max;
      }, new Date(q.createdAt).getTime());

      const daysAgo = Math.floor((now - latestActivity) / msPerDay);

      const incompleteObjs = q.objectives.filter((o) => !o.isCompleted);

      return {
        name: q.name,
        lastInteractionDaysAgo: daysAgo,
        hasHardObjective: incompleteObjs.some(
          (o) => o.difficulty === "HARD" || o.difficulty === "LEGENDARY",
        ),
        hasDebuffedObjective: incompleteObjs.some((o) => o.isDebuffed),
        isSideQuest: q.isSideQuest,
      };
    });

    const messages = evaluateReminderConditions(reminderQuests, {
      frequencyDays,
    });

    if (messages.length === 0) continue;

    const payload = JSON.stringify({
      title: "Executive Dysfunction Planner",
      body: messages[0], // Send the most relevant message
    });

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      // Remove stale subscriptions (410 Gone)
      if (statusCode === 410) {
        await removePushSubscriptionFn(db, sub.endpoint);
        removed++;
      }
    }
  }

  return NextResponse.json({ ok: true, sent, removed });
}
