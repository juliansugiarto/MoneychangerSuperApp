CREATE TABLE `financial_statement_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodStart` datetime NOT NULL,
	`periodEnd` datetime NOT NULL,
	`sourceLabel` varchar(180) NOT NULL,
	`sourceReference` text,
	`profitLossRows` json NOT NULL,
	`balanceSheetRows` json NOT NULL,
	`equityRows` json NOT NULL,
	`validationSummary` json NOT NULL,
	`sourceDigest` varchar(128) NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `financial_statement_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `regulatory_incident_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportNumber` varchar(64) NOT NULL,
	`category` enum('GOVERNANCE','OFFICE_OR_OUTLET','BUSINESS_DISRUPTION','FORCE_MAJEURE','COOPERATION','REGULATOR_REQUEST','OTHER') NOT NULL,
	`incidentAt` datetime NOT NULL,
	`discoveredAt` datetime NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`evidenceReference` text,
	`initialAction` text,
	`status` enum('DRAFT','PREPARED','APPROVED','EXPORTED') NOT NULL DEFAULT 'DRAFT',
	`createdByUserId` int NOT NULL,
	`preparedByUserId` int,
	`preparedAt` datetime,
	`approvedByUserId` int,
	`approvedAt` datetime,
	`approvalNotes` text,
	`exportedByUserId` int,
	`exportedAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `regulatory_incident_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `regulatory_incident_number_uq` UNIQUE(`reportNumber`)
);
--> statement-breakpoint
CREATE INDEX `financial_snapshot_period_idx` ON `financial_statement_snapshots` (`periodStart`,`periodEnd`,`createdAt`);--> statement-breakpoint
CREATE INDEX `financial_snapshot_creator_idx` ON `financial_statement_snapshots` (`createdByUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `regulatory_incident_status_idx` ON `regulatory_incident_reports` (`status`,`incidentAt`);--> statement-breakpoint
CREATE INDEX `regulatory_incident_category_idx` ON `regulatory_incident_reports` (`category`,`createdAt`);