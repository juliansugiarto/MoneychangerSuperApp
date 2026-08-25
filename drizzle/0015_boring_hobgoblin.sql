ALTER TABLE `financial_statement_snapshots` ADD `sourceStorageKey` varchar(500);--> statement-breakpoint
ALTER TABLE `financial_statement_snapshots` ADD `sourceFileName` varchar(255);--> statement-breakpoint
ALTER TABLE `financial_statement_snapshots` ADD `sourceMimeType` varchar(120);