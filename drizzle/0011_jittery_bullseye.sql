CREATE TABLE `operational_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerType` enum('CUSTOMER','TRANSACTION') NOT NULL,
	`documentType` enum('KTP_PHOTO','UNDERLYING') NOT NULL,
	`customerId` int,
	`transactionId` int,
	`storageKey` varchar(500) NOT NULL,
	`originalFileName` varchar(255) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`byteSize` int NOT NULL,
	`documentReference` varchar(160),
	`notes` text,
	`uploadedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operational_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_documents_storage_key_uq` UNIQUE(`storageKey`)
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `phoneNumber` varchar(40);--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `paymentReference` varchar(160);--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `customerFullNameSnapshot` varchar(200);--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `customerIdentityTypeSnapshot` varchar(20);--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `customerIdentityNumberSnapshot` varchar(80);--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `customerPhoneSnapshot` varchar(40);--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `customerAddressSnapshot` text;--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `customerOccupationSnapshot` varchar(160);--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `sourceOfFundsSnapshot` text;--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `transactionPurposeSnapshot` text;--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `customerActingAs` enum('SELF','REPRESENTATIVE') DEFAULT 'SELF' NOT NULL;--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `representativeName` varchar(200);--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `representativeIdentityNumber` varchar(80);--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `underlyingRequired` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `underlyingReference` varchar(160);--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `underlyingNotes` text;--> statement-breakpoint
CREATE INDEX `operational_documents_customer_idx` ON `operational_documents` (`customerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `operational_documents_transaction_idx` ON `operational_documents` (`transactionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `operational_documents_owner_type_idx` ON `operational_documents` (`ownerType`,`documentType`);