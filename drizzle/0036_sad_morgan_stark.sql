CREATE TABLE `employee_pic_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`picRole` enum('INTERNAL_AUDIT','MANAJEMEN_RISIKO','APU_PPT','PERLINDUNGAN_KONSUMEN','NASABAH_RISIKO_TINGGI') NOT NULL,
	`decreeNumber` varchar(120),
	`decreeAt` datetime,
	`documentId` int,
	`assignedAt` datetime NOT NULL,
	`endedAt` datetime,
	`notes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employee_pic_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `employees` MODIFY COLUMN `jobLevel` enum('KOMISARIS','DIREKSI','PEJABAT_EKSEKUTIF','PENYELIA','PELAKSANA') NOT NULL;--> statement-breakpoint
CREATE INDEX `employee_pic_assignments_role_idx` ON `employee_pic_assignments` (`picRole`,`assignedAt`);--> statement-breakpoint
CREATE INDEX `employee_pic_assignments_employee_idx` ON `employee_pic_assignments` (`employeeId`);