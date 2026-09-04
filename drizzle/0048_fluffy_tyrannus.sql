CREATE TABLE `fixed_asset_depreciation_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`periodMonth` varchar(7) NOT NULL,
	`periodId` int NOT NULL,
	`charge` decimal(24,2) NOT NULL,
	`accumulatedAfter` decimal(24,2) NOT NULL,
	`carryingAfter` decimal(24,2) NOT NULL,
	`journalEntryId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fixed_asset_depreciation_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `fixed_asset_depreciation_asset_month_uq` UNIQUE(`assetId`,`periodMonth`)
);
--> statement-breakpoint
CREATE TABLE `fixed_asset_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`capitalisationThresholdIdr` decimal(24,2) NOT NULL DEFAULT '1000000.00',
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fixed_asset_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fixed_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetCode` varchar(60),
	`name` varchar(200) NOT NULL,
	`category` enum('TANAH','BANGUNAN','KENDARAAN','PERALATAN_KANTOR','PERANGKAT_KERAS','PERANGKAT_LUNAK','INVENTARIS_LAIN') NOT NULL,
	`taxGroup` enum('KELOMPOK_1','KELOMPOK_2','KELOMPOK_3','KELOMPOK_4','BANGUNAN_PERMANEN','BANGUNAN_NON_PERMANEN','TIDAK_DISUSUTKAN'),
	`acquisitionDate` date NOT NULL,
	`acquisitionCost` decimal(24,2) NOT NULL,
	`residualValue` decimal(24,2) NOT NULL DEFAULT '0.00',
	`usefulLifeMonths` int,
	`firstJournalMonth` varchar(7) NOT NULL,
	`openingAccumulatedDepreciation` decimal(24,2) NOT NULL DEFAULT '0.00',
	`acquisitionJournalEntryId` int,
	`status` enum('AKTIF','DILEPAS') NOT NULL DEFAULT 'AKTIF',
	`disposalDate` date,
	`disposalProceeds` decimal(24,2),
	`disposalJournalEntryId` int,
	`disposalNotes` text,
	`notes` text,
	`recordedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fixed_assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `fixed_assets_code_uq` UNIQUE(`assetCode`)
);
--> statement-breakpoint
ALTER TABLE `journal_entries` MODIFY COLUMN `sourceType` enum('MANUAL','SALDO_AWAL','TRANSAKSI_VALUTA','PENGELUARAN','MUTASI_KAS','MUTASI_BANK','PENYUSUTAN','PEROLEHAN_ASET','PELEPASAN_ASET','REVALUASI_KURS','TUTUP_PERIODE') NOT NULL DEFAULT 'MANUAL';--> statement-breakpoint
ALTER TABLE `accounting_periods` ADD `depreciationPostedAt` datetime;--> statement-breakpoint
ALTER TABLE `accounting_periods` ADD `depreciationJournalEntryId` int;--> statement-breakpoint
CREATE INDEX `fixed_asset_depreciation_month_idx` ON `fixed_asset_depreciation_entries` (`periodMonth`);--> statement-breakpoint
CREATE INDEX `fixed_asset_depreciation_period_idx` ON `fixed_asset_depreciation_entries` (`periodId`);--> statement-breakpoint
CREATE INDEX `fixed_assets_status_idx` ON `fixed_assets` (`status`,`acquisitionDate`);--> statement-breakpoint
CREATE INDEX `fixed_assets_category_idx` ON `fixed_assets` (`category`);