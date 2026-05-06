import { relations, sql } from "drizzle-orm";
import { index, sqliteTable, unique } from "drizzle-orm/sqlite-core";

// Better Auth core tables
export const user = sqliteTable("user", (d) => ({
  id: d
    .text({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.text({ length: 255 }),
  email: d.text({ length: 255 }).notNull().unique(),
  emailVerified: d.integer({ mode: "boolean" }).default(false),
  image: d.text({ length: 255 }),
  accountTier: d
    .text({ enum: ["ADVENTURER", "PARTY_MEMBER"] })
    .default("ADVENTURER")
    .notNull(),
  createdAt: d
    .integer({ mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
}));

export const userRelations = relations(user, ({ many, one }) => ({
  account: many(account),
  session: many(session),
  quests: many(quest),
  energyStates: many(energyState),
  collaborators: many(collaborator),
  pushSubscriptions: many(pushSubscription),
  reminderPreferences: one(reminderPreferences),
  availabilityWindows: many(availabilityWindow),
  dailyAvailabilityOverrides: many(dailyAvailabilityOverride),
  dailyScheduleItems: many(dailyScheduleItem),
  workSessions: many(workSession),
}));

export const account = sqliteTable(
  "account",
  (d) => ({
    id: d
      .text({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id),
    accountId: d.text({ length: 255 }).notNull(),
    providerId: d.text({ length: 255 }).notNull(),
    accessToken: d.text(),
    refreshToken: d.text(),
    accessTokenExpiresAt: d.integer({ mode: "timestamp" }),
    refreshTokenExpiresAt: d.integer({ mode: "timestamp" }),
    scope: d.text({ length: 255 }),
    idToken: d.text(),
    password: d.text(),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const session = sqliteTable(
  "session",
  (d) => ({
    id: d
      .text({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id),
    token: d.text({ length: 255 }).notNull().unique(),
    expiresAt: d.integer({ mode: "timestamp" }).notNull(),
    ipAddress: d.text({ length: 255 }),
    userAgent: d.text({ length: 255 }),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const verification = sqliteTable(
  "verification",
  (d) => ({
    id: d
      .text({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    identifier: d.text({ length: 255 }).notNull(),
    value: d.text({ length: 255 }).notNull(),
    expiresAt: d.integer({ mode: "timestamp" }).notNull(),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ─── App Tables ───────────────────────────────────────────────────────────────

export const quest = sqliteTable(
  "edp_quest",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: d.text({ length: 255 }).notNull(),
    description: d.text(),
    isArchived: d.integer({ mode: "boolean" }).default(false).notNull(),
    isSideQuest: d.integer({ mode: "boolean" }).default(false).notNull(),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [index("quest_user_id_idx").on(t.userId)],
);

export const questRelations = relations(quest, ({ one, many }) => ({
  user: one(user, { fields: [quest.userId], references: [user.id] }),
  chapters: many(chapter),
  objectives: many(objective),
}));

export const chapter = sqliteTable(
  "edp_chapter",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    questId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => quest.id, { onDelete: "cascade" }),
    name: d.text({ length: 255 }).notNull(),
    order: d.integer({ mode: "number" }).default(0).notNull(),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [index("chapter_quest_id_idx").on(t.questId)],
);

export const chapterRelations = relations(chapter, ({ one, many }) => ({
  quest: one(quest, { fields: [chapter.questId], references: [quest.id] }),
  objectives: many(objective),
}));

export const objective = sqliteTable(
  "edp_objective",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    questId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => quest.id, { onDelete: "cascade" }),
    chapterId: d
      .integer({ mode: "number" })
      .references(() => chapter.id, { onDelete: "set null" }),
    name: d.text({ length: 255 }).notNull(),
    description: d.text(),
    trackingMode: d
      .text({ enum: ["BINARY", "PROGRESS_BAR"] })
      .default("BINARY")
      .notNull(),
    difficulty: d
      .text({ enum: ["EASY", "MEDIUM", "HARD", "LEGENDARY"] })
      .default("MEDIUM")
      .notNull(),
    isDebuffed: d.integer({ mode: "boolean" }).default(false).notNull(),
    isRecruitable: d.integer({ mode: "boolean" }).default(false).notNull(),
    isCompleted: d.integer({ mode: "boolean" }).default(false).notNull(),
    isArchived: d.integer({ mode: "boolean" }).default(false).notNull(),
    order: d.integer({ mode: "number" }).default(0).notNull(),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("objective_quest_id_idx").on(t.questId),
    index("objective_chapter_id_idx").on(t.chapterId),
  ],
);

export const objectiveRelations = relations(objective, ({ one, many }) => ({
  quest: one(quest, { fields: [objective.questId], references: [quest.id] }),
  chapter: one(chapter, {
    fields: [objective.chapterId],
    references: [chapter.id],
  }),
  subTasks: many(subTask),
  counterTools: many(counterTool),
  collaborators: many(collaborator),
  dailyScheduleItems: many(dailyScheduleItem),
  workSessions: many(workSession),
}));

export const subTask = sqliteTable(
  "edp_sub_task",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    objectiveId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => objective.id, { onDelete: "cascade" }),
    name: d.text({ length: 255 }).notNull(),
    isCompleted: d.integer({ mode: "boolean" }).default(false).notNull(),
    order: d.integer({ mode: "number" }).default(0).notNull(),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [index("sub_task_objective_id_idx").on(t.objectiveId)],
);

export const subTaskRelations = relations(subTask, ({ one }) => ({
  objective: one(objective, {
    fields: [subTask.objectiveId],
    references: [objective.id],
  }),
}));

export const counterTool = sqliteTable(
  "edp_counter_tool",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    objectiveId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => objective.id, { onDelete: "cascade" }),
    name: d.text({ length: 255 }).notNull(),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [index("counter_tool_objective_id_idx").on(t.objectiveId)],
);

export const counterToolRelations = relations(counterTool, ({ one }) => ({
  objective: one(objective, {
    fields: [counterTool.objectiveId],
    references: [objective.id],
  }),
}));

export const energyState = sqliteTable(
  "edp_energy_state",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    value: d.text({ enum: ["LOW", "MEDIUM", "HIGH"] }).notNull(),
    date: d.text({ length: 10 }).notNull(), // YYYY-MM-DD
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("energy_state_user_id_idx").on(t.userId),
    unique("energy_state_user_date_unique").on(t.userId, t.date),
  ],
);

export const energyStateRelations = relations(energyState, ({ one }) => ({
  user: one(user, { fields: [energyState.userId], references: [user.id] }),
}));

export const reward = sqliteTable("edp_reward", (d) => ({
  id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
  name: d.text({ length: 255 }).notNull(),
  description: d.text(),
  category: d
    .text({ enum: ["COMFORT", "ENTERTAINMENT", "SOCIAL"] })
    .notNull(),
  createdAt: d
    .integer({ mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
}));

export const collaborator = sqliteTable(
  "edp_collaborator",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    objectiveId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => objective.id, { onDelete: "cascade" }),
    contribution: d.text(), // free-text or JSON contribution data
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("collaborator_user_id_idx").on(t.userId),
    index("collaborator_objective_id_idx").on(t.objectiveId),
    unique("collaborator_user_objective_unique").on(t.userId, t.objectiveId),
  ],
);

export const collaboratorRelations = relations(collaborator, ({ one }) => ({
  user: one(user, { fields: [collaborator.userId], references: [user.id] }),
  objective: one(objective, {
    fields: [collaborator.objectiveId],
    references: [objective.id],
  }),
}));

export const pushSubscription = sqliteTable(
  "edp_push_subscription",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: d.text().notNull().unique(),
    p256dh: d.text().notNull(),
    auth: d.text().notNull(),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [index("push_subscription_user_id_idx").on(t.userId)],
);

export const pushSubscriptionRelations = relations(
  pushSubscription,
  ({ one }) => ({
    user: one(user, {
      fields: [pushSubscription.userId],
      references: [user.id],
    }),
  }),
);

export const reminderPreferences = sqliteTable(
  "edp_reminder_preferences",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: d
      .text({ length: 255 })
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    enabled: d.integer({ mode: "boolean" }).default(true).notNull(),
    // Minimum days between reminders per quest
    frequencyDays: d.integer({ mode: "number" }).default(3).notNull(),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [index("reminder_preferences_user_id_idx").on(t.userId)],
);

export const reminderPreferencesRelations = relations(
  reminderPreferences,
  ({ one }) => ({
    user: one(user, {
      fields: [reminderPreferences.userId],
      references: [user.id],
    }),
  }),
);

// ─── War Table Tables ─────────────────────────────────────────────────────────

export const availabilityWindow = sqliteTable(
  "edp_availability_window",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dayOfWeek: d.integer({ mode: "number" }).notNull(), // 0 = Sunday, 6 = Saturday
    startTime: d.text({ length: 5 }).notNull(), // HH:MM
    endTime: d.text({ length: 5 }).notNull(), // HH:MM
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("availability_window_user_id_idx").on(t.userId),
    index("availability_window_user_day_idx").on(t.userId, t.dayOfWeek),
  ],
);

export const availabilityWindowRelations = relations(
  availabilityWindow,
  ({ one }) => ({
    user: one(user, {
      fields: [availabilityWindow.userId],
      references: [user.id],
    }),
  }),
);

export const dailyAvailabilityOverride = sqliteTable(
  "edp_daily_availability_override",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: d.text({ length: 10 }).notNull(), // YYYY-MM-DD
    startTime: d.text({ length: 5 }).notNull(), // HH:MM
    endTime: d.text({ length: 5 }).notNull(), // HH:MM
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("daily_availability_override_user_id_idx").on(t.userId),
    index("daily_availability_override_user_date_idx").on(t.userId, t.date),
  ],
);

export const dailyAvailabilityOverrideRelations = relations(
  dailyAvailabilityOverride,
  ({ one }) => ({
    user: one(user, {
      fields: [dailyAvailabilityOverride.userId],
      references: [user.id],
    }),
  }),
);

export const dailyScheduleItem = sqliteTable(
  "edp_daily_schedule_item",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    objectiveId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => objective.id, { onDelete: "cascade" }),
    date: d.text({ length: 10 }).notNull(), // YYYY-MM-DD
    intendedDuration: d.integer({ mode: "number" }).notNull(), // minutes
    order: d.integer({ mode: "number" }).default(0).notNull(),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("daily_schedule_item_user_id_idx").on(t.userId),
    index("daily_schedule_item_user_date_idx").on(t.userId, t.date),
    index("daily_schedule_item_objective_id_idx").on(t.objectiveId),
  ],
);

export const dailyScheduleItemRelations = relations(
  dailyScheduleItem,
  ({ one, many }) => ({
    user: one(user, {
      fields: [dailyScheduleItem.userId],
      references: [user.id],
    }),
    objective: one(objective, {
      fields: [dailyScheduleItem.objectiveId],
      references: [objective.id],
    }),
    workSessions: many(workSession),
  }),
);

export const workSession = sqliteTable(
  "edp_work_session",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    objectiveId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => objective.id, { onDelete: "cascade" }),
    scheduleItemId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => dailyScheduleItem.id, { onDelete: "cascade" }),
    date: d.text({ length: 10 }).notNull(), // YYYY-MM-DD
    startedAt: d.integer({ mode: "timestamp" }).notNull(),
    endedAt: d.integer({ mode: "timestamp" }),
    actualDuration: d.integer({ mode: "number" }), // minutes, nullable until completed
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("work_session_user_id_idx").on(t.userId),
    index("work_session_user_date_idx").on(t.userId, t.date),
    index("work_session_schedule_item_id_idx").on(t.scheduleItemId),
    index("work_session_objective_id_idx").on(t.objectiveId),
  ],
);

export const workSessionRelations = relations(workSession, ({ one }) => ({
  user: one(user, { fields: [workSession.userId], references: [user.id] }),
  objective: one(objective, {
    fields: [workSession.objectiveId],
    references: [objective.id],
  }),
  scheduleItem: one(dailyScheduleItem, {
    fields: [workSession.scheduleItemId],
    references: [dailyScheduleItem.id],
  }),
}));
