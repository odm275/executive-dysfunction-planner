/**
 * Development seed script.
 * Run with: bun run db:seed
 *
 * Seeds:
 * - reward table (COMFORT / ENTERTAINMENT / SOCIAL)
 * - A demo dev user with 5 quests and representative objectives
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = createClient({ url: DATABASE_URL });
const db = drizzle(client, { schema });

// ─── Rewards ─────────────────────────────────────────────────────────────────

const REWARDS: Array<{
  name: string;
  description: string;
  category: "COMFORT" | "ENTERTAINMENT" | "SOCIAL";
}> = [
  // COMFORT
  {
    name: "Hot shower or bath",
    description: "Take a long, relaxing hot shower or bath",
    category: "COMFORT",
  },
  {
    name: "Favourite snack",
    description: "Treat yourself to your favourite snack or drink",
    category: "COMFORT",
  },
  {
    name: "Cosy blanket time",
    description: "Wrap up in a blanket and just rest",
    category: "COMFORT",
  },
  {
    name: "Nap",
    description: "Take a guilt-free nap",
    category: "COMFORT",
  },
  {
    name: "Order takeaway",
    description: "Order food from your favourite restaurant",
    category: "COMFORT",
  },
  // ENTERTAINMENT
  {
    name: "Watch an episode",
    description: "Watch one episode of a show you enjoy",
    category: "ENTERTAINMENT",
  },
  {
    name: "Play a video game",
    description: "Spend 30–60 minutes on a game you like",
    category: "ENTERTAINMENT",
  },
  {
    name: "Read for pleasure",
    description: "Read a book, comic, or article just for fun",
    category: "ENTERTAINMENT",
  },
  {
    name: "Browse the internet freely",
    description: "Guilt-free internet time — no productivity",
    category: "ENTERTAINMENT",
  },
  {
    name: "Listen to a full album",
    description: "Put on an album and just listen end-to-end",
    category: "ENTERTAINMENT",
  },
  // SOCIAL
  {
    name: "Text a friend",
    description: "Reach out to someone you care about",
    category: "SOCIAL",
  },
  {
    name: "Video call",
    description: "Catch up with a friend or family member over video",
    category: "SOCIAL",
  },
  {
    name: "Share your win",
    description: "Tell someone about what you just accomplished",
    category: "SOCIAL",
  },
  {
    name: "Plan something fun",
    description: "Make plans with someone you enjoy spending time with",
    category: "SOCIAL",
  },
];

// ─── Dev seed data ────────────────────────────────────────────────────────────

const DEV_USER = {
  id: "dev-user-seed-001",
  name: "Demo Adventurer",
  email: "demo@example.com",
  accountTier: "ADVENTURER" as const,
};

type QuestSeed = {
  name: string;
  description?: string;
  isSideQuest?: boolean;
  objectives: Array<{
    name: string;
    trackingMode?: "BINARY" | "PROGRESS_BAR";
    difficulty?: "EASY" | "MEDIUM" | "HARD" | "LEGENDARY";
    isDebuffed?: boolean;
    subTasks?: string[];
    counterTools?: string[];
  }>;
};

const QUESTS: QuestSeed[] = [
  {
    name: "Wedding Planning",
    description: "All the things we need to sort before the big day.",
    objectives: [
      {
        name: "Book the venue",
        difficulty: "HARD",
        isDebuffed: true,
        counterTools: ["Do this with partner", "Call during business hours only"],
      },
      {
        name: "Send save-the-dates",
        trackingMode: "PROGRESS_BAR",
        difficulty: "MEDIUM",
        subTasks: [
          "Compile guest list",
          "Design save-the-date card",
          "Order prints",
          "Post them",
        ],
      },
      {
        name: "Choose caterer",
        difficulty: "MEDIUM",
      },
      {
        name: "Buy wedding rings",
        difficulty: "EASY",
      },
    ],
  },
  {
    name: "AI Engineer Course",
    description:
      "Work through the AI engineering curriculum and build portfolio projects.",
    objectives: [
      {
        name: "Complete Module 1: Foundations",
        trackingMode: "PROGRESS_BAR",
        difficulty: "EASY",
        subTasks: [
          "Watch intro lectures",
          "Read assigned papers",
          "Complete exercises",
        ],
      },
      {
        name: "Build RAG pipeline project",
        difficulty: "HARD",
        trackingMode: "PROGRESS_BAR",
        subTasks: [
          "Set up vector DB",
          "Implement document ingestion",
          "Wire up retrieval",
          "Test with real queries",
        ],
      },
      {
        name: "Submit final project",
        difficulty: "LEGENDARY",
        isDebuffed: true,
        counterTools: [
          "Break into 25-minute Pomodoro sessions",
          "Work in a coffee shop for a change of scene",
        ],
      },
    ],
  },
  {
    name: "Driving Lessons",
    description: "Get my full driving licence.",
    objectives: [
      {
        name: "Book first lesson",
        difficulty: "EASY",
      },
      {
        name: "Study the Highway Code",
        trackingMode: "PROGRESS_BAR",
        difficulty: "EASY",
        subTasks: [
          "Read rules 1–50",
          "Read rules 51–100",
          "Read rules 101–150",
          "Complete practice questions",
        ],
      },
      {
        name: "Pass theory test",
        difficulty: "MEDIUM",
        isDebuffed: true,
        counterTools: ["Book a morning slot (lower anxiety)", "Bring earbuds"],
      },
      {
        name: "Pass practical test",
        difficulty: "LEGENDARY",
        isDebuffed: true,
        counterTools: ["Remind yourself: one junction at a time"],
      },
    ],
  },
  {
    name: "Cleaning",
    description: "Get the flat to a baseline level of clean.",
    objectives: [
      {
        name: "Tackle the kitchen",
        trackingMode: "PROGRESS_BAR",
        difficulty: "MEDIUM",
        subTasks: [
          "Clear the surfaces",
          "Wash up or load dishwasher",
          "Wipe hob and oven front",
          "Mop floor",
        ],
      },
      {
        name: "Bathroom deep clean",
        difficulty: "MEDIUM",
        isDebuffed: true,
        counterTools: ["15-minute timer only", "Podcast on while you clean"],
      },
      {
        name: "Vacuum living room and bedroom",
        difficulty: "EASY",
      },
      {
        name: "Sort the laundry pile",
        trackingMode: "PROGRESS_BAR",
        difficulty: "EASY",
        subTasks: ["Wash", "Dry", "Fold and put away"],
      },
    ],
  },
  {
    name: "World Map Creation",
    description:
      "Build the Executive Dysfunction Planner app — tracked inside the app itself.",
    isSideQuest: true,
    objectives: [
      {
        name: "Define database schema",
        difficulty: "MEDIUM",
      },
      {
        name: "Set up authentication",
        difficulty: "MEDIUM",
      },
      {
        name: "Build Quest Engine tRPC procedures",
        difficulty: "HARD",
      },
      {
        name: "Build World Map UI",
        difficulty: "LEGENDARY",
        isDebuffed: true,
        counterTools: [
          "Start with one component at a time",
          "Ship ugly first, polish later",
        ],
      },
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Seeding database...");

  // Rewards
  console.log("  Seeding rewards...");
  for (const reward of REWARDS) {
    await db
      .insert(schema.reward)
      .values(reward)
      .onConflictDoNothing();
  }
  console.log(`  ✓ ${REWARDS.length} rewards inserted`);

  // Dev user
  console.log("  Seeding dev user...");
  await db
    .insert(schema.user)
    .values({
      id: DEV_USER.id,
      name: DEV_USER.name,
      email: DEV_USER.email,
      accountTier: DEV_USER.accountTier,
      emailVerified: true,
    })
    .onConflictDoNothing();

  // Quests
  console.log("  Seeding dev quests...");
  for (const questData of QUESTS) {
    const [insertedQuest] = await db
      .insert(schema.quest)
      .values({
        userId: DEV_USER.id,
        name: questData.name,
        description: questData.description,
        isSideQuest: questData.isSideQuest ?? false,
      })
      .returning({ id: schema.quest.id })
      .onConflictDoNothing();

    if (!insertedQuest) continue;

    for (let i = 0; i < questData.objectives.length; i++) {
      const objData = questData.objectives[i]!;
      const [insertedObj] = await db
        .insert(schema.objective)
        .values({
          questId: insertedQuest.id,
          name: objData.name,
          trackingMode: objData.trackingMode ?? "BINARY",
          difficulty: objData.difficulty ?? "MEDIUM",
          isDebuffed: objData.isDebuffed ?? false,
          order: i,
        })
        .returning({ id: schema.objective.id })
        .onConflictDoNothing();

      if (!insertedObj) continue;

      if (objData.subTasks) {
        for (let j = 0; j < objData.subTasks.length; j++) {
          await db
            .insert(schema.subTask)
            .values({
              objectiveId: insertedObj.id,
              name: objData.subTasks[j]!,
              order: j,
            })
            .onConflictDoNothing();
        }
      }

      if (objData.counterTools) {
        for (const tool of objData.counterTools) {
          await db
            .insert(schema.counterTool)
            .values({
              objectiveId: insertedObj.id,
              name: tool,
            })
            .onConflictDoNothing();
        }
      }
    }
  }
  console.log(`  ✓ ${QUESTS.length} quests inserted`);

  console.log("✅ Seed complete");
  client.close();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  client.close();
  process.exit(1);
});
