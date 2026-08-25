CREATE TABLE `regulatory_report_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageNumber` varchar(64) NOT NULL,
	`reportType` enum('LKU','FINANCIAL_READINESS','INCIDENTAL') NOT NULL,
	`periodStart` datetime NOT NULL,
	`periodEnd` datetime NOT NULL,
	`status` enum('DRAFT','PREPARED','APPROVED','EXPORTED') NOT NULL DEFAULT 'DRAFT',
	`dataSnapshot` json NOT NULL,
	`validationSummary` json NOT NULL,
	`sourceDigest` varchar(128) NOT NULL,
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
	CONSTRAINT `regulatory_report_packages_id` PRIMARY KEY(`id`),
	CONSTRAINT `regulatory_report_package_number_uq` UNIQUE(`packageNumber`)
);
--> statement-breakpoint
CREATE INDEX `regulatory_report_period_idx` ON `regulatory_report_packages` (`reportType`,`periodStart`,`periodEnd`,`status`);--> statement-breakpoint
CREATE INDEX `regulatory_report_status_idx` ON `regulatory_report_packages` (`status`,`createdAt`);