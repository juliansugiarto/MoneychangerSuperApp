CREATE TABLE `consumer_complaints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`complaintNumber` varchar(50) NOT NULL,
	`reporterName` varchar(200) NOT NULL,
	`reporterIdentityNumber` varchar(80) NOT NULL,
	`reporterPhone` varchar(40) NOT NULL,
	`reporterEmail` varchar(320),
	`transactionAt` datetime,
	`receiptNumber` varchar(80),
	`transactionDetails` text,
	`chronology` text NOT NULL,
	`supportingDocuments` text,
	`category` enum('CASH_COUNT','BOARD_RATE','STAFF_SERVICE','OTHER') NOT NULL DEFAULT 'OTHER',
	`status` enum('OPEN','IN_REVIEW','RESOLVED','ESCALATED_LAPS_BI') NOT NULL DEFAULT 'OPEN',
	`receivedByUserId` int NOT NULL,
	`resolution` text,
	`resolvedByUserId` int,
	`resolvedAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consumer_complaints_id` PRIMARY KEY(`id`),
	CONSTRAINT `consumer_complaints_number_uq` UNIQUE(`complaintNumber`)
);
--> statement-breakpoint
CREATE INDEX `consumer_complaints_status_idx` ON `consumer_complaints` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `consumer_complaints_receipt_idx` ON `consumer_complaints` (`receiptNumber`);