CREATE TABLE `edp_reminder_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text(255) NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`frequencyDays` integer DEFAULT 3 NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `edp_reminder_preferences_userId_unique` ON `edp_reminder_preferences` (`userId`);--> statement-breakpoint
CREATE INDEX `reminder_preferences_user_id_idx` ON `edp_reminder_preferences` (`userId`);