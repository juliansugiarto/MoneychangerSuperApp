ALTER TABLE `exchange_transactions` MODIFY COLUMN `status` enum('DRAFT','PENDING_REVIEW','APPROVED','COMPLETED','RETURNED','CANCELLED','REVERSED') NOT NULL DEFAULT 'DRAFT';--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `reversedByUserId` int;--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `reversedAt` datetime;--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `reversalReason` text;