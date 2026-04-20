/**
 * @jest-environment node
 *
 * Integration tests for the Energy module.
 * Tests are written against the database layer directly to avoid
 * pulling in ESM-only server dependencies (better-auth, etc.) into Jest.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { and, eq } from "drizzle-orm";
import path from "path";

import * as schema from "~/server/db/schema";
import { energyState } from "~/server/db/schema";

// ---------------------------------------------------------------------------
// In-memory database setup
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

// ---------------------------------------------------------------------------
// Energy helpers that mirror the tRPC procedure logic
// ---------------------------------------------------------------------------

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

async function setEnergy(
  db: TestDb,
  userId: string,
  value: "LOW" | "MEDIUM" | "HIGH",
) {
  const date = todayUTC();

  const existing = await db.query.energyState.findFirst({
    where: and(eq(energyState.userId, userId), eq(energyState.date, date)),
  });

  if (existing) {
    const [updated] = await db
      .update(energyState)
      .set({ value })
      .where(
        and(eq(energyState.userId, userId), eq(energyState.date, date)),
      )
      .returning();
    return updated!;
  }

  const [created] = await db
    .insert(energyState)
    .values({ userId, value, date })
    .returning();
  return created!;
}

async function getTodayEnergy(db: TestDb, userId: string) {
  const date = todayUTC();
  const record = await db.query.energyState.findFirst({
    where: and(eq(energyState.userId, userId), eq(energyState.date, date)),
  });
  return record ?? null;
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
// Tests
// ---------------------------------------------------------------------------

describe("Energy module — setEnergy", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await makeTestDb();
  });

  it("creates an energy record for today", async () => {
    await insertUser(db, "user-e1");
    const result = await setEnergy(db, "user-e1", "HIGH");

    expect(result.value).toBe("HIGH");
    expect(result.userId).toBe("user-e1");
    expect(result.date).toBe(todayUTC());
  });

  it("upserts — calling setEnergy again on the same day updates the record", async () => {
    await insertUser(db, "user-e2");
    await setEnergy(db, "user-e2", "LOW");
    const updated = await setEnergy(db, "user-e2", "MEDIUM");

    expect(updated.value).toBe("MEDIUM");

    // Verify only one record exists for today
    const records = await db
      .select()
      .from(energyState)
      .where(
        and(
          eq(energyState.userId, "user-e2"),
          eq(energyState.date, todayUTC()),
        ),
      );

    expect(records).toHaveLength(1);
    expect(records[0]!.value).toBe("MEDIUM");
  });
});

describe("Energy module — getTodayEnergy", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await makeTestDb();
  });

  it("returns null when no energy has been set today", async () => {
    await insertUser(db, "user-e3");
    const result = await getTodayEnergy(db, "user-e3");
    expect(result).toBeNull();
  });

  it("returns today's energy after it has been set", async () => {
    await insertUser(db, "user-e4");
    await setEnergy(db, "user-e4", "MEDIUM");

    const result = await getTodayEnergy(db, "user-e4");
    expect(result).not.toBeNull();
    expect(result!.value).toBe("MEDIUM");
  });

  it("does not return a record belonging to a different user", async () => {
    await insertUser(db, "user-e5a");
    await insertUser(db, "user-e5b");
    await setEnergy(db, "user-e5a", "HIGH");

    const result = await getTodayEnergy(db, "user-e5b");
    expect(result).toBeNull();
  });
});
