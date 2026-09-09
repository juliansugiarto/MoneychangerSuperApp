CREATE TABLE `customer_watchlist_screenings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`screenedAt` timestamp NOT NULL DEFAULT (now()),
	`screenedByUserId` int,
	`trigger` enum('NASABAH_DIBUAT','NASABAH_DIUBAH','DAFTAR_DIIMPOR','MANUAL') NOT NULL,
	`matchCount` int NOT NULL,
	`summary` text,
	`listSnapshotAt` datetime,
	CONSTRAINT `customer_watchlist_screenings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `highRiskDecision` enum('BELUM','DISETUJUI','DITOLAK') DEFAULT 'BELUM' NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `highRiskDecidedByUserId` int;--> statement-breakpoint
ALTER TABLE `customers` ADD `highRiskDecidedAt` datetime;--> statement-breakpoint
ALTER TABLE `customers` ADD `highRiskDecisionNotes` text;--> statement-breakpoint
CREATE INDEX `customer_watchlist_screening_customer_idx` ON `customer_watchlist_screenings` (`customerId`,`screenedAt`);