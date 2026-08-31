CREATE TABLE `exchange_transaction_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` int NOT NULL,
	`lineNumber` int NOT NULL,
	`currencyId` int NOT NULL,
	`operationalRateId` int,
	`referenceRateSnapshot` decimal(24,6),
	`quoteUnit` decimal(18,6) NOT NULL DEFAULT '1.000000',
	`agreedRate` decimal(24,6) NOT NULL,
	`foreignAmount` decimal(24,6) NOT NULL,
	`rupiahAmount` decimal(24,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exchange_transaction_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cash_balance_movements` DROP INDEX `cash_balance_transaction_movement_uq`;--> statement-breakpoint
ALTER TABLE `exchange_transactions` MODIFY COLUMN `currencyId` int;--> statement-breakpoint
ALTER TABLE `exchange_transactions` MODIFY COLUMN `operationalRateId` int;--> statement-breakpoint
ALTER TABLE `exchange_transactions` MODIFY COLUMN `foreignAmount` decimal(24,6);--> statement-breakpoint
ALTER TABLE `exchange_transactions` MODIFY COLUMN `rateSnapshot` decimal(24,6);--> statement-breakpoint
ALTER TABLE `exchange_transactions` MODIFY COLUMN `quoteUnitSnapshot` decimal(18,6);--> statement-breakpoint
ALTER TABLE `cash_balance_movements` ADD `transactionLineId` int;--> statement-breakpoint
ALTER TABLE `exchange_transaction_denomination_entries` ADD `transactionLineId` int;--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `receiptNumber` varchar(80);--> statement-breakpoint
ALTER TABLE `cash_balance_movements` ADD CONSTRAINT `cash_balance_transaction_line_movement_uq` UNIQUE(`transactionLineId`);--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD CONSTRAINT `exchange_transactions_receipt_number_uq` UNIQUE(`operation`,`receiptNumber`);--> statement-breakpoint
CREATE INDEX `exchange_transaction_lines_transaction_idx` ON `exchange_transaction_lines` (`transactionId`);--> statement-breakpoint
CREATE INDEX `cash_balance_movements_transaction_idx` ON `cash_balance_movements` (`transactionId`);--> statement-breakpoint
CREATE INDEX `exchange_transaction_denomination_entries_line_idx` ON `exchange_transaction_denomination_entries` (`transactionLineId`);