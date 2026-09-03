CREATE TABLE `employee_certifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`competencyCode` varchar(20) NOT NULL,
	`certificateNumber` varchar(120),
	`issuedAt` datetime NOT NULL,
	`expiresAt` datetime,
	`documentId` int,
	`notes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employee_certifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fullName` varchar(200) NOT NULL,
	`identityNumber` varchar(40),
	`position` varchar(120) NOT NULL,
	`jobLevel` enum('DIREKSI','PEJABAT_EKSEKUTIF','PENYELIA','PELAKSANA') NOT NULL,
	`competencyTrack` enum('PBK','SERTIFIKASI_KOMPETENSI','TIDAK_WAJIB') NOT NULL DEFAULT 'TIDAK_WAJIB',
	`employmentStatus` enum('AKTIF','NONAKTIF') NOT NULL DEFAULT 'AKTIF',
	`joinedAt` datetime NOT NULL,
	`endedAt` datetime,
	`education` varchar(120),
	`employmentAgreementNumber` varchar(80),
	`employmentAgreementAt` datetime,
	`screeningResult` enum('DALAM_PROSES','LULUS','TIDAK_LULUS'),
	`screenedAt` datetime,
	`screeningNotes` text,
	`screenedByUserId` int,
	`userId` int,
	`notes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sdm_competency_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodYear` int NOT NULL,
	`periodQuarter` int NOT NULL,
	`competencyCode` varchar(20) NOT NULL,
	`plannedCount` int NOT NULL DEFAULT 0,
	`plannedBudgetIdr` decimal(18,2),
	`notes` text,
	`updatedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sdm_competency_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `sdm_competency_plans_period_code_uq` UNIQUE(`periodYear`,`periodQuarter`,`competencyCode`)
);
--> statement-breakpoint
CREATE INDEX `employee_certifications_employee_idx` ON `employee_certifications` (`employeeId`,`competencyCode`);--> statement-breakpoint
CREATE INDEX `employee_certifications_code_issued_idx` ON `employee_certifications` (`competencyCode`,`issuedAt`);--> statement-breakpoint
CREATE INDEX `employees_status_level_idx` ON `employees` (`employmentStatus`,`jobLevel`);--> statement-breakpoint
CREATE INDEX `employees_track_idx` ON `employees` (`competencyTrack`);