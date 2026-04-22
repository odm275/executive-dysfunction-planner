/**
 * @jest-environment node
 *
 * Integration tests for Collaboration: Recruitable Objectives & Party Members (Issue #13).
 * Tests:
 * - Invite token generation and validation
 * - Collaborator record creation
 * - Contribution tracking
 * - Party Member → Adventurer upgrade
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { and, eq } from "drizzle-orm";
import path from "path";

import * as schema from "~/server/db/schema";
import { quest, objective, collaborator, user } from "~/server/db/schema";

import {
  generateInviteToken,
  verifyInviteToken,
  createCollaboratorFn,
  updateContributionFn,
  upgradeToAdventurerFn,
  listCollaboratorsFn,
  type InvitePayload,
} from "../collaboration-helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

const TEST_SECRET = "test-secret-key-at-least-32-chars-long!!";

async function makeTestDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
  return db;
}

async function insertUser(
  db: TestDb,
  userId: string,
  accountTier: "ADVENTURER" | "PARTY_MEMBER" = "ADVENTURER",
) {
  await db.insert(user).values({
    id: userId,
    email: `${userId}@test.com`,
    emailVerified: false,
    accountTier,
  });
}

async function createQuestWithObjective(db: TestDb, userId: string) {
  const [q] = await db
    .insert(quest)
    .values({ userId, name: "Test Quest" })
    .returning();
  const [obj] = await db
    .insert(objective)
    .values({ questId: q!.id, name: "Recruitable Task", isRecruitable: true })
    .returning();
  return { quest: q!, objective: obj! };
}

// ---------------------------------------------------------------------------
// Token generation and validation
// ---------------------------------------------------------------------------

describe("Invite token — generation", () => {
  it("generates a JWT containing objectiveId", async () => {
    const token = await generateInviteToken(42, TEST_SECRET);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // valid JWT format
  });

  it("different objectiveIds produce different tokens", async () => {
    const t1 = await generateInviteToken(1, TEST_SECRET);
    const t2 = await generateInviteToken(2, TEST_SECRET);
    expect(t1).not.toBe(t2);
  });
});

describe("Invite token — validation", () => {
  it("verifies a valid token and returns the payload", async () => {
    const token = await generateInviteToken(99, TEST_SECRET);
    const payload = await verifyInviteToken(token, TEST_SECRET);
    expect(payload).not.toBeNull();
    expect(payload!.objectiveId).toBe(99);
  });

  it("returns null for an invalid token", async () => {
    const payload = await verifyInviteToken("not.a.valid.jwt", TEST_SECRET);
    expect(payload).toBeNull();
  });

  it("returns null for a token signed with a different secret", async () => {
    const token = await generateInviteToken(1, TEST_SECRET);
    const payload = await verifyInviteToken(token, "wrong-secret-key-also-long!!!!!!");
    expect(payload).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Collaborator creation
// ---------------------------------------------------------------------------

describe("Collaborator — createCollaboratorFn", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("creates a collaborator record linking a Party Member to an objective", async () => {
    await insertUser(db, "adventurer1");
    await insertUser(db, "partyMember1", "PARTY_MEMBER");
    const { objective: obj } = await createQuestWithObjective(db, "adventurer1");

    const collab = await createCollaboratorFn(db, "partyMember1", obj.id);
    expect(collab.userId).toBe("partyMember1");
    expect(collab.objectiveId).toBe(obj.id);
  });

  it("throws if objective does not exist", async () => {
    await insertUser(db, "pm2", "PARTY_MEMBER");
    await expect(
      createCollaboratorFn(db, "pm2", 99999),
    ).rejects.toThrow("Objective not found.");
  });

  it("throws if duplicate collaborator for same user+objective", async () => {
    await insertUser(db, "adventurer2");
    await insertUser(db, "partyMember3", "PARTY_MEMBER");
    const { objective: obj } = await createQuestWithObjective(db, "adventurer2");

    await createCollaboratorFn(db, "partyMember3", obj.id);
    await expect(
      createCollaboratorFn(db, "partyMember3", obj.id),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Contribution tracking
// ---------------------------------------------------------------------------

describe("Collaborator — updateContributionFn", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("updates a collaborator's contribution data", async () => {
    await insertUser(db, "adv3");
    await insertUser(db, "pm4", "PARTY_MEMBER");
    const { objective: obj } = await createQuestWithObjective(db, "adv3");

    await createCollaboratorFn(db, "pm4", obj.id);
    const updated = await updateContributionFn(db, "pm4", obj.id, "50% done");

    expect(updated.contribution).toBe("50% done");
  });

  it("throws if collaborator record does not exist", async () => {
    await insertUser(db, "pm5", "PARTY_MEMBER");
    await expect(
      updateContributionFn(db, "pm5", 99999, "some data"),
    ).rejects.toThrow("Collaborator not found.");
  });
});

// ---------------------------------------------------------------------------
// List collaborators
// ---------------------------------------------------------------------------

describe("Collaborator — listCollaboratorsFn", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("returns all collaborators for an objective", async () => {
    await insertUser(db, "adv4");
    await insertUser(db, "pm6", "PARTY_MEMBER");
    await insertUser(db, "pm7", "PARTY_MEMBER");
    const { objective: obj } = await createQuestWithObjective(db, "adv4");

    await createCollaboratorFn(db, "pm6", obj.id);
    await createCollaboratorFn(db, "pm7", obj.id);

    const collaborators = await listCollaboratorsFn(db, "adv4", obj.id);
    expect(collaborators).toHaveLength(2);
  });

  it("throws if the objective does not belong to the adventurer", async () => {
    await insertUser(db, "adv5");
    await insertUser(db, "adv6");
    const { objective: obj } = await createQuestWithObjective(db, "adv5");

    await expect(
      listCollaboratorsFn(db, "adv6", obj.id),
    ).rejects.toThrow("Objective not found.");
  });
});

// ---------------------------------------------------------------------------
// Tier upgrade
// ---------------------------------------------------------------------------

describe("upgradeToAdventurerFn", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("upgrades a Party Member account to Adventurer", async () => {
    await insertUser(db, "pm8", "PARTY_MEMBER");
    const upgraded = await upgradeToAdventurerFn(db, "pm8");
    expect(upgraded.accountTier).toBe("ADVENTURER");
  });

  it("is idempotent — upgrading an Adventurer does nothing harmful", async () => {
    await insertUser(db, "adv7", "ADVENTURER");
    const result = await upgradeToAdventurerFn(db, "adv7");
    expect(result.accountTier).toBe("ADVENTURER");
  });

  it("throws if user does not exist", async () => {
    await expect(
      upgradeToAdventurerFn(db, "nonexistent"),
    ).rejects.toThrow("User not found.");
  });
});
