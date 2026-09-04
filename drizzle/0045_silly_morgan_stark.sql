CREATE TABLE `stock_opname_denominations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stockOpnameId` int NOT NULL,
	`location` enum('COUNTER','SAFE') NOT NULL,
	`denominationValue` decimal(24,6) NOT NULL,
	`quantity` int NOT NULL,
	`subtotal` decimal(24,6) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_opname_denominations_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_opname_denominations_opname_location_value_uq` UNIQUE(`stockOpnameId`,`location`,`denominationValue`)
);
--> statement-breakpoint
ALTER TABLE `stock_opnames` ADD `physicalCounterBalance` decimal(24,6);--> statement-breakpoint
ALTER TABLE `stock_opnames` ADD `physicalSafeBalance` decimal(24,6);--> statement-breakpoint
ALTER TABLE `stock_opnames` ADD `closingSystemSafeBalance` decimal(24,6);--> statement-breakpoint
ALTER TABLE `stock_opnames` ADD `hasDenominationVariance` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `stock_opname_denominations_opname_idx` ON `stock_opname_denominations` (`stockOpnameId`);