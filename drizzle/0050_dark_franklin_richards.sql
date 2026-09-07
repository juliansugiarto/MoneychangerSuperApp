CREATE TABLE `financial_statement_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`noteKey` varchar(60) NOT NULL,
	`periodKey` varchar(7),
	`bodyText` text NOT NULL,
	`updatedByUserId` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financial_statement_notes_id` PRIMARY KEY(`id`),
	CONSTRAINT `financial_note_key_period_uq` UNIQUE(`noteKey`,`periodKey`)
);
--> statement-breakpoint
CREATE TABLE `ledger_settlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settlementDate` date NOT NULL,
	`direction` enum('PEMBAYARAN','PENERIMAAN') NOT NULL,
	`targetType` enum('BEBAN','ASET_TETAP') NOT NULL,
	`expenseId` int,
	`fixedAssetId` int,
	`amount` decimal(24,2) NOT NULL,
	`cashMovementId` int,
	`bankMovementId` int,
	`notes` varchar(500) NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ledger_settlements_id` PRIMARY KEY(`id`),
	CONSTRAINT `ledger_settlement_cash_movement_uq` UNIQUE(`cashMovementId`),
	CONSTRAINT `ledger_settlement_bank_movement_uq` UNIQUE(`bankMovementId`)
);
--> statement-breakpoint
ALTER TABLE `bank_account_movements` MODIFY COLUMN `category` enum('OPENING','TRANSACTION','ADJUSTMENT','CAPITAL_INJECTION','CAPITAL_WITHDRAWAL','CASH_TRANSFER','KEWAJIBAN_DIBAYAR','PIUTANG_DITERIMA','OTHER') NOT NULL DEFAULT 'OTHER';--> statement-breakpoint
ALTER TABLE `cash_balance_movements` MODIFY COLUMN `category` enum('OPENING','TRANSACTION','SAFE_DEPOSIT','SAFE_WITHDRAWAL','OFF_HOURS_SALE','DENOMINATION_EXCHANGE','CAPITAL_INJECTION','CAPITAL_WITHDRAWAL','BANK_DEPOSIT','BANK_WITHDRAWAL','KEWAJIBAN_DIBAYAR','PIUTANG_DITERIMA','OTHER') NOT NULL DEFAULT 'OTHER';--> statement-breakpoint
CREATE INDEX `ledger_settlement_expense_idx` ON `ledger_settlements` (`expenseId`);--> statement-breakpoint
CREATE INDEX `ledger_settlement_asset_idx` ON `ledger_settlements` (`fixedAssetId`);--> statement-breakpoint
CREATE INDEX `ledger_settlement_date_idx` ON `ledger_settlements` (`settlementDate`);