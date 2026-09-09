CREATE TABLE `ira_assessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodStart` datetime NOT NULL,
	`periodEnd` datetime NOT NULL,
	`trigger` enum('TAHUNAN','MANUAL') NOT NULL,
	`triggerReason` text,
	`status` enum('DRAFT','MENUNGGU_PERSETUJUAN','DISETUJUI') NOT NULL DEFAULT 'DRAFT',
	`supersededByAssessmentId` int,
	`inherentScore` decimal(6,4),
	`inherentPredicate` enum('TINGGI','MENENGAH_KE_TINGGI','MENENGAH','RENDAH_KE_MENENGAH','RENDAH'),
	`kpmrScore` decimal(6,4),
	`kpmrPredicate` enum('UNSATISFACTORY','MARGINAL','FAIR','SATISFACTORY','STRONG'),
	`finalValue` int,
	`finalPredicate` enum('TINGGI','MENENGAH_KE_TINGGI','MENENGAH','RENDAH_KE_MENENGAH','RENDAH'),
	`frozenThresholds` json,
	`frozenClassifications` json,
	`createdByUserId` int NOT NULL,
	`submittedByUserId` int,
	`submittedAt` datetime,
	`approvedByUserId` int,
	`approvedAt` datetime,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ira_assessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ira_inherent_values` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assessmentId` int NOT NULL,
	`parameterCode` varchar(40) NOT NULL,
	`machineScore` int,
	`appliedScore` int NOT NULL,
	`bandIndex` int,
	`overrideReason` text,
	`basis` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ira_inherent_values_id` PRIMARY KEY(`id`),
	CONSTRAINT `ira_inherent_values_parameter_uq` UNIQUE(`assessmentId`,`parameterCode`)
);
--> statement-breakpoint
CREATE TABLE `ira_kpmr_answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assessmentId` int NOT NULL,
	`questionCode` varchar(40) NOT NULL,
	`answered` boolean NOT NULL DEFAULT false,
	`score` int,
	`note` text,
	`documentReference` varchar(500),
	`answeredByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ira_kpmr_answers_id` PRIMARY KEY(`id`),
	CONSTRAINT `ira_kpmr_answers_question_uq` UNIQUE(`assessmentId`,`questionCode`)
);
--> statement-breakpoint
CREATE TABLE `ira_structural_declarations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assessmentId` int NOT NULL,
	`parameterCode` varchar(40) NOT NULL,
	`choiceCode` varchar(30) NOT NULL,
	`reason` text NOT NULL,
	`declaredByUserId` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ira_structural_declarations_id` PRIMARY KEY(`id`),
	CONSTRAINT `ira_structural_declarations_parameter_uq` UNIQUE(`assessmentId`,`parameterCode`)
);
--> statement-breakpoint
CREATE INDEX `ira_assessments_period_idx` ON `ira_assessments` (`periodStart`,`periodEnd`,`status`);--> statement-breakpoint
CREATE INDEX `ira_assessments_status_idx` ON `ira_assessments` (`status`,`createdAt`);