CREATE TABLE `exchange_transaction_payment_denominations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` int NOT NULL,
	`currencyId` int NOT NULL,
	`denominationValue` decimal(24,6) NOT NULL,
	`quantity` int NOT NULL,
	`lineTotal` decimal(24,6) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exchange_transaction_payment_denominations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `exchange_transaction_payment_denominations_transaction_idx` ON `exchange_transaction_payment_denominations` (`transactionId`);