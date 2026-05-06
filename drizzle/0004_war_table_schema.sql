CREATE TABLE `edp_availability_window` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text(255) NOT NULL,
	`dayOfWeek` integer NOT NULL,
	`startTime` text(5) NOT NULL,
	`endTime` text(5) NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `availability_window_user_id_idx` ON `edp_availability_window` (`userId`);--> statement-breakpoint
CREATE INDEX `availability_window_user_day_idx` ON `edp_availability_window` (`userId`,`dayOfWeek`);--> statement-breakpoint
CREATE TABLE `edp_daily_availability_override` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text(255) NOT NULL,
	`date` text(10) NOT NULL,
	`startTime` text(5) NOT NULL,
	`endTime` text(5) NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `daily_availability_override_user_id_idx` ON `edp_daily_availability_override` (`userId`);--> statement-breakpoint
CREATE INDEX `daily_availability_override_user_date_idx` ON `edp_daily_availability_override` (`userId`,`date`);--> statement-breakpoint
CREATE TABLE `edp_daily_schedule_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text(255) NOT NULL,
	`objectiveId` integer NOT NULL,
	`date` text(10) NOT NULL,
	`intendedDuration` integer NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`objectiveId`) REFERENCES `edp_objective`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `daily_schedule_item_user_id_idx` ON `edp_daily_schedule_item` (`userId`);--> statement-breakpoint
CREATE INDEX `daily_schedule_item_user_date_idx` ON `edp_daily_schedule_item` (`userId`,`date`);--> statement-breakpoint
CREATE INDEX `daily_schedule_item_objective_id_idx` ON `edp_daily_schedule_item` (`objectiveId`);--> statement-breakpoint
CREATE TABLE `edp_work_session` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text(255) NOT NULL,
	`objectiveId` integer NOT NULL,
	`scheduleItemId` integer NOT NULL,
	`date` text(10) NOT NULL,
	`startedAt` integer NOT NULL,
	`endedAt` integer,
	`actualDuration` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`objectiveId`) REFERENCES `edp_objective`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scheduleItemId`) REFERENCES `edp_daily_schedule_item`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `work_session_user_id_idx` ON `edp_work_session` (`userId`);--> statement-breakpoint
CREATE INDEX `work_session_user_date_idx` ON `edp_work_session` (`userId`,`date`);--> statement-breakpoint
CREATE INDEX `work_session_schedule_item_id_idx` ON `edp_work_session` (`scheduleItemId`);--> statement-breakpoint
CREATE INDEX `work_session_objective_id_idx` ON `edp_work_session` (`objectiveId`);
