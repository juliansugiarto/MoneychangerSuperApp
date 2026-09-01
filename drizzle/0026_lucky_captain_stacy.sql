ALTER TABLE `exchange_transactions` ADD `counterpartyBankName` varchar(120);--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `counterpartyAccountNumber` varchar(60);--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `counterpartyAccountHolderName` varchar(160);--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `counterpartyNameMismatchReason` text;