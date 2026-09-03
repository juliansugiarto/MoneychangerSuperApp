CREATE TABLE `employee_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fullName` varchar(200) NOT NULL,
	`identityNumber` varchar(40),
	`appliedPosition` varchar(120) NOT NULL,
	`appliedAt` datetime NOT NULL,
	`screeningResult` enum('DALAM_PROSES','LULUS','TIDAK_LULUS') NOT NULL DEFAULT 'DALAM_PROSES',
	`screenedAt` datetime,
	`screeningNotes` text,
	`watchlistCheckedAt` datetime,
	`watchlistMatchCount` int NOT NULL DEFAULT 0,
	`watchlistSummary` text,
	`decision` enum('DALAM_PROSES','DITERIMA','TIDAK_DITERIMA') NOT NULL DEFAULT 'DALAM_PROSES',
	`decidedAt` datetime,
	`employeeId` int,
	`notes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employee_candidates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `employee_candidates_decision_idx` ON `employee_candidates` (`decision`,`appliedAt`);