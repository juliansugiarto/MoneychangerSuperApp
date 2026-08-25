ALTER TABLE `regulatory_report_packages` MODIFY COLUMN `status` enum('DRAFT','PREPARED','RETURNED','APPROVED','EXPORTED') NOT NULL DEFAULT 'DRAFT';--> statement-breakpoint
ALTER TABLE `regulatory_report_packages` MODIFY `status` enum('DRAFT','PREPARED','RETURNED','APPROVED','EXPORTED') NOT NULL DEFAULT 'DRAFT';--> statement-breakpoint
ALTER TABLE `regulatory_report_packages` ADD `returnedByUserId` int;--> statement-breakpoint
ALTER TABLE `regulatory_report_packages` ADD `returnedAt` datetime;--> statement-breakpoint
ALTER TABLE `regulatory_report_packages` ADD `returnNotes` text;--> statement-breakpoint
ALTER TABLE `regulatory_report_packages` ADD `manualDueAt` datetime;--> statement-breakpoint
ALTER TABLE `regulatory_report_packages` ADD `manualDueNotes` text;--> statement-breakpoint
CREATE INDEX `regulatory_report_manual_due_idx` ON `regulatory_report_packages` (`status`,`manualDueAt`);
