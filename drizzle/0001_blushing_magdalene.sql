CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(100) NOT NULL,
	`entityId` varchar(100) NOT NULL,
	`beforeState` json,
	`afterState` json,
	`reason` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cash_balance_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cashBalanceId` int NOT NULL,
	`transactionId` int,
	`direction` enum('IN','OUT','ADJUSTMENT') NOT NULL,
	`amount` decimal(24,6) NOT NULL,
	`reason` varchar(255) NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cash_balance_movements_id` PRIMARY KEY(`id`),
	CONSTRAINT `cash_balance_transaction_movement_uq` UNIQUE(`transactionId`)
);
--> statement-breakpoint
CREATE TABLE `cash_balances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`currencyId` int NOT NULL,
	`availableAmount` decimal(24,6) NOT NULL DEFAULT '0.000000',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cash_balances_id` PRIMARY KEY(`id`),
	CONSTRAINT `cash_balances_currency_uq` UNIQUE(`currencyId`)
);
--> statement-breakpoint
CREATE TABLE `currencies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(3) NOT NULL,
	`name` varchar(100) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `currencies_id` PRIMARY KEY(`id`),
	CONSTRAINT `currencies_code_uq` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cifNumber` varchar(40) NOT NULL,
	`fullName` varchar(200) NOT NULL,
	`identityType` enum('KTP','PASSPORT','OTHER') NOT NULL,
	`identityNumber` varchar(80) NOT NULL,
	`identityExpiryDate` date,
	`placeOfBirth` varchar(120),
	`dateOfBirth` date,
	`address` text NOT NULL,
	`occupation` varchar(160),
	`sourceOfFunds` text,
	`transactionPurpose` text,
	`profileStatus` enum('ACTIVE','RESTRICTED','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
	`riskLevel` enum('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'LOW',
	`riskNotes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_cif_uq` UNIQUE(`cifNumber`),
	CONSTRAINT `customers_identity_uq` UNIQUE(`identityType`,`identityNumber`)
);
--> statement-breakpoint
CREATE TABLE `exchange_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionNumber` varchar(50) NOT NULL,
	`transactionAt` datetime NOT NULL,
	`operation` enum('BUY','SELL') NOT NULL,
	`customerId` int NOT NULL,
	`tellerUserId` int NOT NULL,
	`currencyId` int NOT NULL,
	`operationalRateId` int NOT NULL,
	`foreignAmount` decimal(24,6) NOT NULL,
	`rateSnapshot` decimal(24,6) NOT NULL,
	`rupiahAmount` decimal(24,2) NOT NULL,
	`paymentMethod` enum('CASH','BANK_TRANSFER','OTHER') NOT NULL,
	`status` enum('DRAFT','PENDING_REVIEW','APPROVED','COMPLETED','RETURNED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`requiresReview` boolean NOT NULL DEFAULT false,
	`reviewStatus` enum('NOT_REVIEWED','NEEDS_REVIEW','REVIEWED','ESCALATED') NOT NULL DEFAULT 'NOT_REVIEWED',
	`reviewReason` text,
	`reviewedByUserId` int,
	`reviewedAt` datetime,
	`reviewerNotes` text,
	`approvedByUserId` int,
	`approvedAt` datetime,
	`cancelledByUserId` int,
	`cancelledAt` datetime,
	`cancellationReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `exchange_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `exchange_transactions_number_uq` UNIQUE(`transactionNumber`)
);
--> statement-breakpoint
CREATE TABLE `operational_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`currencyId` int NOT NULL,
	`referenceSnapshotId` int,
	`buyRate` decimal(24,6) NOT NULL,
	`sellRate` decimal(24,6) NOT NULL,
	`effectiveAt` datetime NOT NULL,
	`status` enum('DRAFT','ACTIVE','RETIRED') NOT NULL DEFAULT 'DRAFT',
	`proposedByUserId` int NOT NULL,
	`approvedByUserId` int,
	`approvedAt` datetime,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operational_rates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operational_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingCode` varchar(50) NOT NULL,
	`reviewThresholdUsd` decimal(24,2) NOT NULL DEFAULT '10000.00',
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_settings_code_uq` UNIQUE(`settingCode`)
);
--> statement-breakpoint
CREATE TABLE `rate_reference_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`currencyId` int NOT NULL,
	`referenceDate` date NOT NULL,
	`source` enum('BI_TRANSACTION_RATES') NOT NULL DEFAULT 'BI_TRANSACTION_RATES',
	`buyRate` decimal(24,6) NOT NULL,
	`sellRate` decimal(24,6) NOT NULL,
	`sourceUrl` varchar(500) NOT NULL,
	`fetchedAt` datetime NOT NULL,
	`payloadHash` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rate_reference_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `rate_reference_currency_date_source_uq` UNIQUE(`currencyId`,`referenceDate`,`source`)
);
--> statement-breakpoint
CREATE TABLE `rate_sync_configurations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` enum('BI_TRANSACTION_RATES') NOT NULL DEFAULT 'BI_TRANSACTION_RATES',
	`scheduleCronTaskUid` varchar(65),
	`cronExpression` varchar(80) NOT NULL DEFAULT '0 15 9 * * 1-5',
	`enabled` boolean NOT NULL DEFAULT true,
	`lastSuccessfulAt` datetime,
	`lastAttemptAt` datetime,
	`lastError` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rate_sync_configurations_id` PRIMARY KEY(`id`),
	CONSTRAINT `rate_sync_source_uq` UNIQUE(`source`)
);
--> statement-breakpoint
CREATE TABLE `rate_sync_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`configurationId` int NOT NULL,
	`status` enum('STARTED','SUCCEEDED','FAILED','SKIPPED') NOT NULL,
	`runAt` datetime NOT NULL,
	`referenceDate` date,
	`message` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rate_sync_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_opnames` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opnameDate` date NOT NULL,
	`currencyId` int NOT NULL,
	`openingSystemBalance` decimal(24,6) NOT NULL,
	`purchases` decimal(24,6) NOT NULL DEFAULT '0.000000',
	`sales` decimal(24,6) NOT NULL DEFAULT '0.000000',
	`adjustments` decimal(24,6) NOT NULL DEFAULT '0.000000',
	`closingSystemBalance` decimal(24,6) NOT NULL,
	`physicalBalance` decimal(24,6),
	`variance` decimal(24,6),
	`reconciliationStatus` enum('OPEN','SUBMITTED','RECONCILED','VARIANCE') NOT NULL DEFAULT 'OPEN',
	`tellerUserId` int NOT NULL,
	`reviewerUserId` int,
	`reviewedAt` datetime,
	`varianceNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stock_opnames_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_opnames_date_currency_uq` UNIQUE(`opnameDate`,`currencyId`)
);
--> statement-breakpoint
CREATE TABLE `transaction_review_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` int NOT NULL,
	`action` enum('FLAGGED','APPROVED','RETURNED','ESCALATED','REVIEWED') NOT NULL,
	`reviewerUserId` int NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transaction_review_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('TELLER','SUPERVISOR','DIRECTOR','ADMIN') NOT NULL DEFAULT 'TELLER';--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entityType`,`entityId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_idx` ON `audit_logs` (`actorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `cash_balance_movements_balance_idx` ON `cash_balance_movements` (`cashBalanceId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `customers_profile_status_idx` ON `customers` (`profileStatus`);--> statement-breakpoint
CREATE INDEX `exchange_transactions_date_idx` ON `exchange_transactions` (`transactionAt`);--> statement-breakpoint
CREATE INDEX `exchange_transactions_status_idx` ON `exchange_transactions` (`status`,`reviewStatus`);--> statement-breakpoint
CREATE INDEX `exchange_transactions_customer_idx` ON `exchange_transactions` (`customerId`);--> statement-breakpoint
CREATE INDEX `operational_rate_currency_status_idx` ON `operational_rates` (`currencyId`,`status`);--> statement-breakpoint
CREATE INDEX `operational_rate_effective_idx` ON `operational_rates` (`effectiveAt`);--> statement-breakpoint
CREATE INDEX `rate_reference_date_idx` ON `rate_reference_snapshots` (`referenceDate`);--> statement-breakpoint
CREATE INDEX `rate_sync_runs_configuration_idx` ON `rate_sync_runs` (`configurationId`,`runAt`);--> statement-breakpoint
CREATE INDEX `stock_opnames_status_idx` ON `stock_opnames` (`reconciliationStatus`);--> statement-breakpoint
CREATE INDEX `transaction_review_actions_transaction_idx` ON `transaction_review_actions` (`transactionId`,`createdAt`);