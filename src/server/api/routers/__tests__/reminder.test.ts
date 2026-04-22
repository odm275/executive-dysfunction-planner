/**
 * @jest-environment node
 *
 * Integration tests for Smart Reminders via Web Push (Issue #14).
 * Tests:
 * - Reminder condition evaluation (pure logic)
 * - Push subscription storage helpers
 * - Reminder preferences helpers
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import path from "path";

import * as schema from "~/server/db/schema";
import {
  storePushSubscriptionFn,
  removePushSubscriptionFn,
  updateReminderPreferencesFn,
  getReminderPreferencesFn,
  evaluateReminderConditions,
  type ReminderCheckQuest,
} from "../reminder-helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

async function makeTestDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
  return db;
}

async function insertUser(db: TestDb, userId: string) {
  await db.insert(schema.user).values({
    id: userId,
    email: `${userId}@test.com`,
    emailVerified: false,
    accountTier: "ADVENTURER",
  });
}

// ---------------------------------------------------------------------------
// Push subscription storage
// ---------------------------------------------------------------------------

describe("Reminder — push subscription storage", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("stores a push subscription for a user", async () => {
    await insertUser(db, "u1");
    const sub = await storePushSubscriptionFn(db, "u1", {
      endpoint: "https://push.example.com/sub/abc123",
      p256dh: "dGVzdC1rZXk=",
      auth: "dGVzdC1hdXRo",
    });
    expect(sub.userId).toBe("u1");
    expect(sub.endpoint).toBe("https://push.example.com/sub/abc123");
  });

  it("upserts when the same endpoint is re-registered", async () => {
    await insertUser(db, "u2");
    await storePushSubscriptionFn(db, "u2", {
      endpoint: "https://push.example.com/sub/xyz",
      p256dh: "key1",
      auth: "auth1",
    });
    const updated = await storePushSubscriptionFn(db, "u2", {
      endpoint: "https://push.example.com/sub/xyz",
      p256dh: "key2",
      auth: "auth2",
    });
    expect(updated.p256dh).toBe("key2");
  });

  it("removes a push subscription by endpoint", async () => {
    await insertUser(db, "u3");
    await storePushSubscriptionFn(db, "u3", {
      endpoint: "https://push.example.com/sub/del",
      p256dh: "k",
      auth: "a",
    });
    await removePushSubscriptionFn(db, "https://push.example.com/sub/del");

    const subs = await db.query.pushSubscription.findMany({
      where: eq(schema.pushSubscription.userId, "u3"),
    });
    expect(subs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Reminder preferences
// ---------------------------------------------------------------------------

describe("Reminder — preferences", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("creates default preferences if none exist", async () => {
    await insertUser(db, "u4");
    const prefs = await getReminderPreferencesFn(db, "u4");
    expect(prefs.enabled).toBe(true);
    expect(prefs.frequencyDays).toBe(3);
  });

  it("updates preferences", async () => {
    await insertUser(db, "u5");
    await updateReminderPreferencesFn(db, "u5", {
      enabled: false,
      frequencyDays: 7,
    });
    const prefs = await getReminderPreferencesFn(db, "u5");
    expect(prefs.enabled).toBe(false);
    expect(prefs.frequencyDays).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// Reminder condition evaluation (pure logic)
// ---------------------------------------------------------------------------

function makeQuest(overrides: Partial<ReminderCheckQuest> & { id: number }): ReminderCheckQuest {
  return {
    name: `Quest ${overrides.id}`,
    lastInteractionDaysAgo: 1,
    hasHardObjective: false,
    hasDebuffedObjective: false,
    isSideQuest: false,
    ...overrides,
  };
}

describe("Reminder condition evaluation", () => {
  it("generates a staleness message when quest not interacted with in N+ days", () => {
    const quest = makeQuest({ id: 1, name: "Driving Lessons", lastInteractionDaysAgo: 5 });
    const messages = evaluateReminderConditions([quest], { frequencyDays: 3 });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("Driving Lessons");
    expect(messages[0]).toContain("5 day");
  });

  it("does not generate a message for recently-active quests", () => {
    const quest = makeQuest({ id: 2, name: "Daily Quest", lastInteractionDaysAgo: 1 });
    const messages = evaluateReminderConditions([quest], { frequencyDays: 3 });
    expect(messages).toHaveLength(0);
  });

  it("generates a Hard objective message", () => {
    const quest = makeQuest({
      id: 3,
      name: "Wedding Planning",
      lastInteractionDaysAgo: 1,
      hasHardObjective: true,
    });
    const messages = evaluateReminderConditions([quest], { frequencyDays: 3 });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("Wedding Planning");
    expect(messages[0]!.toLowerCase()).toMatch(/hard|energy/);
  });

  it("generates a debuffed objective message", () => {
    const quest = makeQuest({
      id: 4,
      name: "AI Engineer Course",
      lastInteractionDaysAgo: 1,
      hasDebuffedObjective: true,
    });
    const messages = evaluateReminderConditions([quest], { frequencyDays: 3 });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("AI Engineer Course");
  });

  it("excludes side quests from staleness checks", () => {
    const quest = makeQuest({
      id: 5,
      name: "World Map Creation",
      lastInteractionDaysAgo: 10,
      isSideQuest: true,
    });
    const messages = evaluateReminderConditions([quest], { frequencyDays: 3 });
    expect(messages).toHaveLength(0);
  });

  it("limits to one message per quest (first matching condition wins)", () => {
    const quest = makeQuest({
      id: 6,
      name: "Cleaning",
      lastInteractionDaysAgo: 7,
      hasHardObjective: true,
      hasDebuffedObjective: true,
    });
    const messages = evaluateReminderConditions([quest], { frequencyDays: 3 });
    expect(messages).toHaveLength(1);
  });
});
