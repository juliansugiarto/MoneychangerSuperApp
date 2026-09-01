CREATE TABLE `bank_account_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bankAccountId` int NOT NULL,
	`transactionId` int,
	`transactionLineId` int,
	`direction` enum('IN','OUT','ADJUSTMENT') NOT NULL,
	`amount` decimal(24,6) NOT NULL,
	`reason` varchar(255) NOT NULL,
	`category` enum('OPENING','TRANSACTION','ADJUSTMENT','OTHER') NOT NULL DEFAULT 'OTHER',
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bank_account_movements_id` PRIMARY KEY(`id`),
	CONSTRAINT `bank_account_movement_transaction_line_uq` UNIQUE(`transactionLineId`)
);
--> statement-breakpoint
CREATE TABLE `bank_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bankName` varchar(120) NOT NULL,
	`accountHolderName` varchar(160) NOT NULL,
	`accountNumber` varchar(60) NOT NULL,
	`currencyId` int NOT NULL,
	`availableAmount` decimal(24,6) NOT NULL DEFAULT '0.000000',
	`active` boolean NOT NULL DEFAULT true,
	`notes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bank_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `bank_accounts_bank_number_uq` UNIQUE(`bankName`,`accountNumber`)
);
--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `bankAccountId` int;--> statement-breakpoint
CREATE INDEX `bank_account_movements_account_idx` ON `bank_account_movements` (`bankAccountId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `bank_accounts_currency_idx` ON `bank_accounts` (`currencyId`);