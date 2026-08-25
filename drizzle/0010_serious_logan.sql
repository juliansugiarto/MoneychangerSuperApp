CREATE TABLE `public_announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(180) NOT NULL,
	`content` text NOT NULL,
	`status` enum('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
	`publishedAt` datetime,
	`expiresAt` datetime,
	`createdByUserId` int NOT NULL,
	`publishedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `public_announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestNumber` varchar(50) NOT NULL,
	`requesterName` varchar(200) NOT NULL,
	`contactChannel` enum('PHONE','WHATSAPP','EMAIL') NOT NULL,
	`contactValue` varchar(320) NOT NULL,
	`currencyId` int NOT NULL,
	`operation` enum('BUY','SELL') NOT NULL,
	`foreignAmount` decimal(24,6) NOT NULL,
	`preferredServiceAt` datetime,
	`contactConsent` boolean NOT NULL,
	`status` enum('BARU','MENUNGGU_VERIFIKASI','KURS_DIKONFIRMASI','SIAP_DILAYANI','KEDALUWARSA','DIBATALKAN') NOT NULL DEFAULT 'BARU',
	`assignedToUserId` int,
	`confirmedOperationalRateId` int,
	`confirmedRateExpiresAt` datetime,
	`staffNotes` text,
	`confirmedByUserId` int,
	`confirmedAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `service_requests_number_uq` UNIQUE(`requestNumber`)
);
--> statement-breakpoint
CREATE INDEX `public_announcements_status_published_idx` ON `public_announcements` (`status`,`publishedAt`);--> statement-breakpoint
CREATE INDEX `public_announcements_expiry_idx` ON `public_announcements` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `service_requests_status_created_idx` ON `service_requests` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `service_requests_currency_status_idx` ON `service_requests` (`currencyId`,`status`);--> statement-breakpoint
CREATE INDEX `service_requests_assignee_status_idx` ON `service_requests` (`assignedToUserId`,`status`);