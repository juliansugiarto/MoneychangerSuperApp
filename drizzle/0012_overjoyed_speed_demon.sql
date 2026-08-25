CREATE TABLE `daily_operational_checklists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessDate` date NOT NULL,
	`openingChecks` json NOT NULL,
	`closingChecks` json NOT NULL,
	`openingCompletedAt` datetime,
	`openingCompletedByUserId` int,
	`closingCompletedAt` datetime,
	`closingCompletedByUserId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_operational_checklists_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_operational_checklist_date_uq` UNIQUE(`businessDate`)
);
--> statement-breakpoint
CREATE TABLE `director_acknowledgements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventType` enum('FLAGGED_TRANSACTION_APPROVED','STOCK_VARIANCE','RATE_SHOCK','CONSUMER_COMPLAINT') NOT NULL,
	`entityType` varchar(100) NOT NULL,
	`entityId` varchar(100) NOT NULL,
	`title` varchar(255) NOT NULL,
	`detail` text NOT NULL,
	`createdByUserId` int,
	`acknowledgedByUserId` int,
	`acknowledgedAt` datetime,
	`acknowledgementNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `director_acknowledgements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `market_rate_observations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`currencyId` int NOT NULL,
	`sourceName` varchar(80) NOT NULL,
	`sourceKind` enum('OFFICIAL','MARKET','MANUAL') NOT NULL,
	`sourceUrl` varchar(500),
	`quoteUnit` decimal(18,6) NOT NULL DEFAULT '1.000000',
	`buyRate` decimal(24,6) NOT NULL,
	`sellRate` decimal(24,6) NOT NULL,
	`observedAt` datetime NOT NULL,
	`payloadHash` varchar(128),
	`notes` text,
	`recordedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `market_rate_observations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rate_volatility_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`currencyId` int NOT NULL,
	`sourceName` varchar(80) NOT NULL,
	`observationId` int,
	`referenceSnapshotId` int,
	`operationalRateId` int,
	`alertType` enum('REFERENCE_MOVEMENT','OUTLET_DEVIATION') NOT NULL,
	`percentageChange` decimal(10,4) NOT NULL,
	`severity` enum('ATTENTION','HIGH') NOT NULL DEFAULT 'ATTENTION',
	`message` text NOT NULL,
	`resolvedAt` datetime,
	`resolvedByUserId` int,
	`resolutionNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rate_volatility_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `operational_settings` ADD `rateShockThresholdPercent` decimal(8,4) DEFAULT '1.5000' NOT NULL;--> statement-breakpoint
CREATE INDEX `director_acknowledgement_open_idx` ON `director_acknowledgements` (`acknowledgedAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `director_acknowledgement_entity_idx` ON `director_acknowledgements` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `market_rate_observation_currency_source_idx` ON `market_rate_observations` (`currencyId`,`sourceName`,`observedAt`);--> statement-breakpoint
CREATE INDEX `market_rate_observation_source_idx` ON `market_rate_observations` (`sourceName`,`observedAt`);--> statement-breakpoint
CREATE INDEX `rate_volatility_alert_open_idx` ON `rate_volatility_alerts` (`resolvedAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `rate_volatility_alert_currency_idx` ON `rate_volatility_alerts` (`currencyId`,`createdAt`);