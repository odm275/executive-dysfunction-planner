CREATE TABLE `account` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`userId` text(255) NOT NULL,
	`accountId` text(255) NOT NULL,
	`providerId` text(255) NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text(255),
	`idToken` text,
	`password` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE TABLE `edp_chapter` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`questId` integer NOT NULL,
	`name` text(255) NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`questId`) REFERENCES `edp_quest`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chapter_quest_id_idx` ON `edp_chapter` (`questId`);--> statement-breakpoint
CREATE TABLE `edp_collaborator` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text(255) NOT NULL,
	`objectiveId` integer NOT NULL,
	`contribution` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`objectiveId`) REFERENCES `edp_objective`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collaborator_user_id_idx` ON `edp_collaborator` (`userId`);--> statement-breakpoint
CREATE INDEX `collaborator_objective_id_idx` ON `edp_collaborator` (`objectiveId`);--> statement-breakpoint
CREATE UNIQUE INDEX `collaborator_user_objective_unique` ON `edp_collaborator` (`userId`,`objectiveId`);--> statement-breakpoint
CREATE TABLE `edp_counter_tool` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`objectiveId` integer NOT NULL,
	`name` text(255) NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`objectiveId`) REFERENCES `edp_objective`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `counter_tool_objective_id_idx` ON `edp_counter_tool` (`objectiveId`);--> statement-breakpoint
CREATE TABLE `edp_energy_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text(255) NOT NULL,
	`value` text NOT NULL,
	`date` text(10) NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `energy_state_user_id_idx` ON `edp_energy_state` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `energy_state_user_date_unique` ON `edp_energy_state` (`userId`,`date`);--> statement-breakpoint
CREATE TABLE `edp_objective` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`questId` integer NOT NULL,
	`chapterId` integer,
	`name` text(255) NOT NULL,
	`trackingMode` text DEFAULT 'BINARY' NOT NULL,
	`difficulty` text DEFAULT 'MEDIUM' NOT NULL,
	`isDebuffed` integer DEFAULT false NOT NULL,
	`isRecruitable` integer DEFAULT false NOT NULL,
	`isCompleted` integer DEFAULT false NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`questId`) REFERENCES `edp_quest`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapterId`) REFERENCES `edp_chapter`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `objective_quest_id_idx` ON `edp_objective` (`questId`);--> statement-breakpoint
CREATE INDEX `objective_chapter_id_idx` ON `edp_objective` (`chapterId`);--> statement-breakpoint
CREATE TABLE `edp_push_subscription` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text(255) NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `edp_push_subscription_endpoint_unique` ON `edp_push_subscription` (`endpoint`);--> statement-breakpoint
CREATE INDEX `push_subscription_user_id_idx` ON `edp_push_subscription` (`userId`);--> statement-breakpoint
CREATE TABLE `edp_quest` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text(255) NOT NULL,
	`name` text(255) NOT NULL,
	`description` text,
	`isArchived` integer DEFAULT false NOT NULL,
	`isSideQuest` integer DEFAULT false NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quest_user_id_idx` ON `edp_quest` (`userId`);--> statement-breakpoint
CREATE TABLE `edp_reward` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(255) NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`userId` text(255) NOT NULL,
	`token` text(255) NOT NULL,
	`expiresAt` integer NOT NULL,
	`ipAddress` text(255),
	`userAgent` text(255),
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE TABLE `edp_sub_task` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`objectiveId` integer NOT NULL,
	`name` text(255) NOT NULL,
	`isCompleted` integer DEFAULT false NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`objectiveId`) REFERENCES `edp_objective`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sub_task_objective_id_idx` ON `edp_sub_task` (`objectiveId`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`name` text(255),
	`email` text(255) NOT NULL,
	`emailVerified` integer DEFAULT false,
	`image` text(255),
	`accountTier` text DEFAULT 'ADVENTURER' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`identifier` text(255) NOT NULL,
	`value` text(255) NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);