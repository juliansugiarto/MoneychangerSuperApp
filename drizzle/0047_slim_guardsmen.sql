CREATE TABLE `period_closing_valuations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodId` int NOT NULL,
	`currencyId` int NOT NULL,
	`quantity` decimal(24,6) NOT NULL,
	`stockOpnameId` int NOT NULL,
	`opnameDate` date NOT NULL,
	`rateSnapshotId` int NOT NULL,
	`rateReferenceDate` date NOT NULL,
	`buyRate` decimal(24,6) NOT NULL,
	`sellRate` decimal(24,6) NOT NULL,
	`quoteUnit` decimal(18,6) NOT NULL,
	`midRatePerUnit` decimal(24,12) NOT NULL,
	`rupiahValue` decimal(24,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `period_closing_valuations_id` PRIMARY KEY(`id`),
	CONSTRAINT `period_closing_valuations_period_currency_uq` UNIQUE(`periodId`,`currencyId`)
);
--> statement-breakpoint
ALTER TABLE `accounting_periods` ADD `valuationPostedAt` datetime;--> statement-breakpoint
ALTER TABLE `accounting_periods` ADD `valuationJournalEntryId` int;--> statement-breakpoint
ALTER TABLE `accounting_periods` ADD `profitClosingPostedAt` datetime;--> statement-breakpoint
ALTER TABLE `accounting_periods` ADD `profitClosingJournalEntryId` int;--> statement-breakpoint
CREATE INDEX `period_closing_valuations_period_idx` ON `period_closing_valuations` (`periodId`);