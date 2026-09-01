ALTER TABLE `operational_documents` MODIFY COLUMN `documentType` enum('KTP_PHOTO','UNDERLYING','UNDERLYING_FORM','UNDERLYING_STATEMENT','UNDERLYING_INVOICE','COMPANY_LOGO','LICENSE_CERTIFICATE','LICENSE_ATTACHMENT') NOT NULL;--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `thresholdReason` text;--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `isSuspiciousTransaction` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `suspiciousIndicators` json;--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `suspiciousNotes` text;