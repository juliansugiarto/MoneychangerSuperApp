ALTER TABLE `customers` ADD `relationshipEndedAt` datetime;--> statement-breakpoint
ALTER TABLE `operational_documents` ADD `deactivatedAt` datetime;--> statement-breakpoint
ALTER TABLE `operational_documents` ADD `deactivatedByUserId` int;--> statement-breakpoint
ALTER TABLE `operational_documents` ADD `deactivationReason` text;