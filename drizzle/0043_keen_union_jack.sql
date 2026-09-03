CREATE TABLE `accounting_periods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodStart` date NOT NULL,
	`periodEnd` date NOT NULL,
	`status` enum('TERBUKA','DITUTUP') NOT NULL DEFAULT 'TERBUKA',
	`closedByUserId` int,
	`closedAt` datetime,
	`closingNotes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounting_periods_id` PRIMARY KEY(`id`),
	CONSTRAINT `accounting_periods_range_uq` UNIQUE(`periodStart`,`periodEnd`)
);
--> statement-breakpoint
CREATE TABLE `chart_of_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(12) NOT NULL,
	`name` varchar(160) NOT NULL,
	`type` enum('ASET','KEWAJIBAN','EKUITAS','PENDAPATAN','HARGA_POKOK','BEBAN','LAIN_LAIN','PAJAK') NOT NULL,
	`normalBalance` enum('DEBIT','KREDIT') NOT NULL,
	`isContra` boolean NOT NULL DEFAULT false,
	`forms` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chart_of_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `chart_of_accounts_code_uq` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entryNumber` varchar(40) NOT NULL,
	`entryDate` date NOT NULL,
	`description` varchar(500) NOT NULL,
	`sourceType` enum('MANUAL','SALDO_AWAL','TRANSAKSI_VALUTA','PENGELUARAN','MUTASI_KAS','MUTASI_BANK','PENYUSUTAN','REVALUASI_KURS','TUTUP_PERIODE') NOT NULL DEFAULT 'MANUAL',
	`sourceReference` varchar(120),
	`branchId` int,
	`totalDebit` decimal(24,2) NOT NULL,
	`totalCredit` decimal(24,2) NOT NULL,
	`reversesEntryId` int,
	`reversalReason` text,
	`postedByUserId` int NOT NULL,
	`postedAt` datetime NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `journal_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `journal_entries_number_uq` UNIQUE(`entryNumber`),
	CONSTRAINT `journal_entries_source_uq` UNIQUE(`sourceType`,`sourceReference`)
);
--> statement-breakpoint
CREATE TABLE `journal_entry_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entryId` int NOT NULL,
	`lineNumber` int NOT NULL,
	`accountCode` varchar(12) NOT NULL,
	`side` enum('DEBIT','KREDIT') NOT NULL,
	`amount` decimal(24,2) NOT NULL,
	`currencyCode` varchar(3),
	`foreignAmount` decimal(24,6),
	`branchId` int,
	`memo` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `journal_entry_lines_id` PRIMARY KEY(`id`),
	CONSTRAINT `journal_entry_lines_entry_line_uq` UNIQUE(`entryId`,`lineNumber`)
);
--> statement-breakpoint
CREATE INDEX `accounting_periods_status_idx` ON `accounting_periods` (`status`,`periodStart`);--> statement-breakpoint
CREATE INDEX `chart_of_accounts_type_idx` ON `chart_of_accounts` (`type`,`code`);--> statement-breakpoint
CREATE INDEX `journal_entries_date_idx` ON `journal_entries` (`entryDate`,`id`);--> statement-breakpoint
CREATE INDEX `journal_entries_reverses_idx` ON `journal_entries` (`reversesEntryId`);--> statement-breakpoint
CREATE INDEX `journal_entry_lines_account_idx` ON `journal_entry_lines` (`accountCode`,`entryId`);