CREATE TABLE `rate_tiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`currencyId` int NOT NULL,
	`label` varchar(40) NOT NULL,
	`denominationValues` json NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rate_tiers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `exchange_transaction_denomination_entries` ADD `operationalRateId` int;--> statement-breakpoint
ALTER TABLE `exchange_transaction_denomination_entries` ADD `referenceRateSnapshot` decimal(24,6);--> statement-breakpoint
ALTER TABLE `exchange_transaction_denomination_entries` ADD `rateDeviationPercent` decimal(8,4);--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `rateDeviationReason` varchar(1000);--> statement-breakpoint
ALTER TABLE `operational_rates` ADD `rateTierId` int;--> statement-breakpoint
ALTER TABLE `operational_rates` ADD `approvalReason` varchar(1000);--> statement-breakpoint
ALTER TABLE `operational_rates` ADD `activationBatchId` varchar(36);--> statement-breakpoint
ALTER TABLE `operational_settings` ADD `rateDeviationTolerancePercent` decimal(8,4) DEFAULT '0.5000' NOT NULL;--> statement-breakpoint
CREATE INDEX `rate_tiers_currency_active_idx` ON `rate_tiers` (`currencyId`,`active`);--> statement-breakpoint
CREATE INDEX `operational_rate_currency_tier_status_idx` ON `operational_rates` (`currencyId`,`rateTierId`,`status`);--> statement-breakpoint
CREATE INDEX `operational_rate_activation_batch_idx` ON `operational_rates` (`activationBatchId`);