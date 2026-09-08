CREATE TABLE `customer_profile_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`reviewedAt` datetime NOT NULL,
	`outcome` enum('TIDAK_ADA_PERUBAHAN','ADA_PERUBAHAN','PERLU_TINDAK_LANJUT') NOT NULL,
	`notes` text,
	`deviationReasons` json,
	`reviewedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_profile_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `declaredMonthlyValueIdr` decimal(24,2);--> statement-breakpoint
ALTER TABLE `customers` ADD `declaredMonthlyCount` int;--> statement-breakpoint
ALTER TABLE `customers` ADD `declaredCurrencies` json;--> statement-breakpoint
CREATE INDEX `customer_profile_reviews_customer_idx` ON `customer_profile_reviews` (`customerId`,`reviewedAt`);