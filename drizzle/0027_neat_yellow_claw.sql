CREATE TABLE `company_profile` (
	`id` int AUTO_INCREMENT NOT NULL,
	`legalEntityName` varchar(200) NOT NULL,
	`tradingName` varchar(200) NOT NULL,
	`licenseNumber` varchar(80),
	`kupvaCode` varchar(40),
	`npwp` varchar(40),
	`nib` varchar(40),
	`biReporterCode` varchar(80),
	`address` text,
	`phone` varchar(60),
	`email` varchar(200),
	`website` varchar(200),
	`baseCurrencyCode` varchar(3) NOT NULL DEFAULT 'IDR',
	`logoDocumentId` int,
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `company_profile_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `operational_documents` MODIFY COLUMN `ownerType` enum('CUSTOMER','TRANSACTION','COMPANY') NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_documents` MODIFY COLUMN `documentType` enum('KTP_PHOTO','UNDERLYING','COMPANY_LOGO','LICENSE_CERTIFICATE','LICENSE_ATTACHMENT') NOT NULL;