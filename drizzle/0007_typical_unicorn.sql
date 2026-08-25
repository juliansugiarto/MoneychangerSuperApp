DROP INDEX `customers_live_status_idx` ON `customers`;--> statement-breakpoint
DROP INDEX `exchange_transactions_live_date_idx` ON `exchange_transactions`;--> statement-breakpoint
DROP INDEX `operational_rate_live_status_idx` ON `operational_rates`;--> statement-breakpoint
DROP INDEX `stock_opnames_live_status_idx` ON `stock_opnames`;--> statement-breakpoint
ALTER TABLE `customers` ADD `isHistorical` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `historicalSourceKey` varchar(180);--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `isHistorical` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `historicalSourceKey` varchar(180);--> statement-breakpoint
ALTER TABLE `operational_rates` ADD `isHistorical` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_rates` ADD `historicalSourceKey` varchar(180);--> statement-breakpoint
ALTER TABLE `stock_opnames` ADD `isHistorical` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_opnames` ADD `historicalSourceKey` varchar(180);--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_historicalSourceKey_unique` UNIQUE(`historicalSourceKey`);--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD CONSTRAINT `exchange_transactions_historicalSourceKey_unique` UNIQUE(`historicalSourceKey`);--> statement-breakpoint
ALTER TABLE `operational_rates` ADD CONSTRAINT `operational_rates_historicalSourceKey_unique` UNIQUE(`historicalSourceKey`);--> statement-breakpoint
ALTER TABLE `stock_opnames` ADD CONSTRAINT `stock_opnames_historicalSourceKey_unique` UNIQUE(`historicalSourceKey`);--> statement-breakpoint
CREATE INDEX `customers_live_status_idx` ON `customers` (`isDemo`,`isHistorical`,`profileStatus`);--> statement-breakpoint
CREATE INDEX `exchange_transactions_live_date_idx` ON `exchange_transactions` (`isDemo`,`isHistorical`,`transactionAt`);--> statement-breakpoint
CREATE INDEX `operational_rate_live_status_idx` ON `operational_rates` (`isDemo`,`isHistorical`,`status`,`currencyId`);--> statement-breakpoint
CREATE INDEX `stock_opnames_live_status_idx` ON `stock_opnames` (`isDemo`,`isHistorical`,`reconciliationStatus`);