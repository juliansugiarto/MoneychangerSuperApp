CREATE TABLE `exchange_transaction_denomination_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` int NOT NULL,
	`denominationValue` decimal(24,6) NOT NULL,
	`quantity` int NOT NULL,
	`lineTotal` decimal(24,6) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exchange_transaction_denomination_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `representativeCustomerId` int;--> statement-breakpoint
CREATE INDEX `exchange_transaction_denomination_entries_transaction_idx` ON `exchange_transaction_denomination_entries` (`transactionId`);--> statement-breakpoint
CREATE INDEX `exchange_transactions_representative_idx` ON `exchange_transactions` (`representativeCustomerId`);