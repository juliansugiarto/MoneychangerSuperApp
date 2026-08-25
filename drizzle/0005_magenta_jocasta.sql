ALTER TABLE `customers` ADD `isDemo` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `isDemo` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_rates` ADD `isDemo` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `rate_reference_snapshots` ADD `isDemo` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_opnames` ADD `isDemo` boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `customers` SET `isDemo` = true WHERE `cifNumber` LIKE 'DEMO-%';--> statement-breakpoint
UPDATE `exchange_transactions` SET `isDemo` = true WHERE `transactionNumber` LIKE 'DEMO-%';--> statement-breakpoint
UPDATE `operational_rates` SET `isDemo` = true WHERE `notes` LIKE '[DEMO]%';--> statement-breakpoint
UPDATE `rate_reference_snapshots` SET `isDemo` = true WHERE `payloadHash` LIKE 'DEMO-%';--> statement-breakpoint
UPDATE `stock_opnames` SET `isDemo` = true WHERE `varianceNotes` LIKE '[DEMO]%';--> statement-breakpoint
CREATE INDEX `customers_live_status_idx` ON `customers` (`isDemo`,`profileStatus`);--> statement-breakpoint
CREATE INDEX `exchange_transactions_live_date_idx` ON `exchange_transactions` (`isDemo`,`transactionAt`);--> statement-breakpoint
CREATE INDEX `operational_rate_live_status_idx` ON `operational_rates` (`isDemo`,`status`,`currencyId`);--> statement-breakpoint
CREATE INDEX `stock_opnames_live_status_idx` ON `stock_opnames` (`isDemo`,`reconciliationStatus`);
