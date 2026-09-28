CREATE TABLE `attempted_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blockId` int NOT NULL,
	`customerId` int NOT NULL,
	`representativeCustomerId` int,
	`blockedParty` enum('NASABAH','KUASA') NOT NULL,
	`tellerUserId` int NOT NULL,
	`attemptedAt` datetime NOT NULL,
	`operation` enum('BUY','SELL') NOT NULL,
	`linesSummary` text NOT NULL,
	`totalIdr` decimal(24,2) NOT NULL,
	CONSTRAINT `attempted_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ira_classification_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewedAt` datetime NOT NULL,
	`reviewedByUserId` int NOT NULL,
	`notes` text NOT NULL,
	`snapshot` longtext NOT NULL,
	`classificationCount` int NOT NULL,
	CONSTRAINT `ira_classification_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `watchlist_blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`openedAt` datetime NOT NULL,
	`source` enum('PENYARINGAN','PETUGAS','PENGISIAN_AWAL') NOT NULL,
	`screeningId` int,
	`matchKeys` text,
	`status` enum('OPEN','CONFIRMED','FALSE_POSITIVE','DICABUT') NOT NULL DEFAULT 'OPEN',
	`resolvedByUserId` int,
	`resolvedAt` datetime,
	`resolutionNotes` text,
	`ltkmReference` varchar(200),
	`biCopySentAt` datetime,
	`revocationReference` varchar(200),
	CONSTRAINT `watchlist_blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `operational_settings` ADD `iraClassificationReviewMonths` int DEFAULT 12 NOT NULL;--> statement-breakpoint
CREATE INDEX `attempted_transactions_block_idx` ON `attempted_transactions` (`blockId`,`attemptedAt`);--> statement-breakpoint
CREATE INDEX `ira_classification_reviews_at_idx` ON `ira_classification_reviews` (`reviewedAt`);--> statement-breakpoint
CREATE INDEX `watchlist_blocks_customer_idx` ON `watchlist_blocks` (`customerId`,`status`);--> statement-breakpoint
CREATE INDEX `watchlist_blocks_status_idx` ON `watchlist_blocks` (`status`,`openedAt`);--> statement-breakpoint
-- Pengisian awal: kecocokan yang sudah ada sebelum 0062 wajib terblokir sejak migrasi ini.
INSERT INTO `watchlist_blocks` (`customerId`, `openedAt`, `source`, `screeningId`, `matchKeys`, `status`)
SELECT c.`id`, UTC_TIMESTAMP(), 'PENGISIAN_AWAL', s.`id`, NULL, 'OPEN'
FROM `customers` c
LEFT JOIN `customer_watchlist_screenings` s ON s.`id` = (
  SELECT s2.`id` FROM `customer_watchlist_screenings` s2 WHERE s2.`customerId` = c.`id` ORDER BY s2.`screenedAt` DESC, s2.`id` DESC LIMIT 1
)
WHERE c.`isDemo` = false AND c.`isHistorical` = false
  AND (c.`dttotPpsdmMatch` = true OR s.`matchCount` > 0);