ALTER TABLE `sanctions_watchlist_entries` MODIFY COLUMN `listType` enum('DTTOT','PPPSM','DPPSPM') NOT NULL;--> statement-breakpoint
UPDATE `sanctions_watchlist_entries` SET `listType` = 'DPPSPM' WHERE `listType` = 'PPPSM';--> statement-breakpoint
ALTER TABLE `sanctions_watchlist_entries` MODIFY COLUMN `listType` enum('DTTOT','DPPSPM') NOT NULL;
