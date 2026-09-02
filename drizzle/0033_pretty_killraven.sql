CREATE TABLE `sanctions_watchlist_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listType` enum('DTTOT','PPPSM') NOT NULL,
	`sourceLabel` varchar(60),
	`entityType` enum('INDIVIDUAL','ENTITY') NOT NULL,
	`referenceCode` varchar(60),
	`fullName` varchar(500) NOT NULL,
	`aliases` text,
	`dateOfBirth` varchar(255),
	`placeOfBirth` varchar(255),
	`nationality` varchar(255),
	`identityNumbers` text,
	`address` text,
	`description` text,
	`sourceFileName` varchar(255) NOT NULL,
	`importedByUserId` int NOT NULL,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sanctions_watchlist_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `sanctions_watchlist_entries_scope_idx` ON `sanctions_watchlist_entries` (`listType`,`sourceLabel`);--> statement-breakpoint
CREATE INDEX `sanctions_watchlist_entries_name_idx` ON `sanctions_watchlist_entries` (`fullName`);