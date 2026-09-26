CREATE TABLE `app_installation` (
	`id` int NOT NULL DEFAULT 1,
	`setupCompletedAt` datetime,
	`setupCodeHash` varchar(200),
	`setupCodeExpiresAt` datetime,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_installation_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `owner_recovery_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`codeHash` varchar(200) NOT NULL,
	`usedAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `owner_recovery_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `company_profile` ADD `themePalette` enum('MARUN','ZAMRUD','SAMUDRA','TERAKOTA','ANGGUR','ARANG') DEFAULT 'MARUN' NOT NULL;--> statement-breakpoint
ALTER TABLE `company_profile` ADD `accentColor` varchar(7);--> statement-breakpoint
ALTER TABLE `company_profile` ADD `publicPageEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `company_profile` ADD `secondaryPhone` varchar(60);--> statement-breakpoint
ALTER TABLE `company_profile` ADD `openingHours` varchar(500);--> statement-breakpoint
ALTER TABLE `company_profile` ADD `mapUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `company_profile` ADD `publicFaq` json;--> statement-breakpoint
ALTER TABLE `company_profile` ADD `fraudWarning` text;--> statement-breakpoint
CREATE INDEX `owner_recovery_codes_user_idx` ON `owner_recovery_codes` (`userId`);