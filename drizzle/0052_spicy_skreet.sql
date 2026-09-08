CREATE TABLE `company_document_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyDocumentId` int NOT NULL,
	`versionNumber` int NOT NULL,
	`operationalDocumentId` int NOT NULL,
	`validFrom` date NOT NULL,
	`validUntil` date,
	`changeReason` text,
	`supersededAt` datetime,
	`uploadedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `company_document_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `company_document_versions_number_uq` UNIQUE(`companyDocumentId`,`versionNumber`),
	CONSTRAINT `company_document_versions_file_uq` UNIQUE(`operationalDocumentId`)
);
--> statement-breakpoint
CREATE TABLE `company_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` enum('SOP','KEBIJAKAN_INTERNAL','SURAT_BI','NOTULEN_RAPAT','KORESPONDENSI_REGULATOR','LAINNYA') NOT NULL,
	`title` varchar(250) NOT NULL,
	`referenceNumber` varchar(160),
	`responsibleEmployeeId` int,
	`notes` text,
	`deactivatedAt` datetime,
	`deactivatedByUserId` int,
	`deactivationReason` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `company_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `operational_documents` MODIFY COLUMN `ownerType` enum('CUSTOMER','TRANSACTION','COMPANY','EXPENSE','COMPANY_ARCHIVE') NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_documents` MODIFY COLUMN `documentType` enum('KTP_PHOTO','UNDERLYING','UNDERLYING_FORM','UNDERLYING_STATEMENT','UNDERLYING_INVOICE','COMPANY_LOGO','LICENSE_CERTIFICATE','LICENSE_ATTACHMENT','EXPENSE_RECEIPT','COMPANY_ARCHIVE_FILE') NOT NULL;--> statement-breakpoint
CREATE INDEX `company_document_versions_current_idx` ON `company_document_versions` (`companyDocumentId`,`supersededAt`);--> statement-breakpoint
CREATE INDEX `company_documents_category_idx` ON `company_documents` (`category`,`deactivatedAt`);--> statement-breakpoint
CREATE INDEX `company_documents_responsible_idx` ON `company_documents` (`responsibleEmployeeId`);