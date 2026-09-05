CREATE TABLE `currency_revaluations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodId` int NOT NULL,
	`currencyId` int NOT NULL,
	`foreignBalance` decimal(24,6) NOT NULL,
	`carryingBefore` decimal(24,2) NOT NULL,
	`rateSnapshotId` int NOT NULL,
	`rateReferenceDate` date NOT NULL,
	`midRatePerUnit` decimal(30,12) NOT NULL,
	`carryingAfter` decimal(24,2) NOT NULL,
	`difference` decimal(24,2) NOT NULL,
	`journalEntryId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `currency_revaluations_id` PRIMARY KEY(`id`),
	CONSTRAINT `currency_revaluation_period_currency_uq` UNIQUE(`periodId`,`currencyId`)
);
--> statement-breakpoint
ALTER TABLE `accounting_periods` ADD `revaluationPostedAt` datetime;--> statement-breakpoint
ALTER TABLE `accounting_periods` ADD `revaluationJournalEntryId` int;--> statement-breakpoint
CREATE INDEX `currency_revaluation_period_idx` ON `currency_revaluations` (`periodId`);