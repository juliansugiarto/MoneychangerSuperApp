CREATE TABLE `employee_profile_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`reviewedAt` datetime NOT NULL,
	`outcome` enum('TIDAK_ADA_PERUBAHAN','ADA_PERUBAHAN','PERLU_TINDAK_LANJUT') NOT NULL,
	`notes` text,
	`reviewedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employee_profile_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `employee_profile_reviews_employee_idx` ON `employee_profile_reviews` (`employeeId`,`reviewedAt`);