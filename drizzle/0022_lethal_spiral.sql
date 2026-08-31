CREATE TABLE `cash_denomination_balances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`currencyId` int NOT NULL,
	`denominationValue` decimal(24,6) NOT NULL,
	`quantity` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cash_denomination_balances_id` PRIMARY KEY(`id`),
	CONSTRAINT `cash_denomination_balances_currency_value_uq` UNIQUE(`currencyId`,`denominationValue`)
);
