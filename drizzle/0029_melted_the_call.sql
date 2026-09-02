CREATE TABLE `operational_expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expenseDate` date NOT NULL,
	`category` enum('SEWA','GAJI','UTILITAS','PERLENGKAPAN_OPERASIONAL','PEMASARAN','PEMELIHARAAN','IZIN_DAN_PAJAK','LAINNYA') NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`description` varchar(500) NOT NULL,
	`notes` text,
	`recordedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operational_expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `operational_documents` MODIFY COLUMN `ownerType` enum('CUSTOMER','TRANSACTION','COMPANY','EXPENSE') NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_documents` MODIFY COLUMN `documentType` enum('KTP_PHOTO','UNDERLYING','UNDERLYING_FORM','UNDERLYING_STATEMENT','UNDERLYING_INVOICE','COMPANY_LOGO','LICENSE_CERTIFICATE','LICENSE_ATTACHMENT','EXPENSE_RECEIPT') NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_documents` ADD `expenseId` int;--> statement-breakpoint
CREATE INDEX `operational_expenses_date_idx` ON `operational_expenses` (`expenseDate`);--> statement-breakpoint
CREATE INDEX `operational_expenses_category_idx` ON `operational_expenses` (`category`,`expenseDate`);--> statement-breakpoint
CREATE INDEX `operational_documents_expense_idx` ON `operational_documents` (`expenseId`,`createdAt`);