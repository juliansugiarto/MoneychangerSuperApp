CREATE TABLE `apu_training_attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`employeeId` int NOT NULL,
	`evaluation` varchar(120),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `apu_training_attendance_id` PRIMARY KEY(`id`),
	CONSTRAINT `apu_training_attendance_session_employee_uq` UNIQUE(`sessionId`,`employeeId`)
);
--> statement-breakpoint
CREATE TABLE `apu_training_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`heldAt` datetime NOT NULL,
	`topic` text NOT NULL,
	`method` enum('IN_HOUSE','EKSTERNAL','DARING') NOT NULL DEFAULT 'IN_HOUSE',
	`facilitator` varchar(200) NOT NULL,
	`materials` text,
	`notes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `apu_training_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `apu_training_attendance_employee_idx` ON `apu_training_attendance` (`employeeId`);--> statement-breakpoint
CREATE INDEX `apu_training_sessions_held_idx` ON `apu_training_sessions` (`heldAt`);