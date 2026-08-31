CREATE TABLE `cash_denomination_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cashBalanceMovementId` int NOT NULL,
	`denominationValue` decimal(24,6) NOT NULL,
	`quantity` int NOT NULL,
	`subtotal` decimal(24,6) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cash_denomination_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cash_balance_movements` ADD `category` enum('OPENING','TRANSACTION','SAFE_DEPOSIT','SAFE_WITHDRAWAL','OFF_HOURS_SALE','OTHER') DEFAULT 'OTHER' NOT NULL;--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `referenceRateSnapshot` decimal(24,6);--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `dealNotes` varchar(255);--> statement-breakpoint
CREATE INDEX `cash_denomination_entries_movement_idx` ON `cash_denomination_entries` (`cashBalanceMovementId`);