ALTER TABLE `customers` ADD `hasBeneficialOwner` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `beneficialOwnerCustomerId` int;--> statement-breakpoint
ALTER TABLE `customers` ADD `pepStatus` enum('NONE','SELF','RELATED') DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `pepDetails` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `dttotPpsdmMatch` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `dttotPpsdmNotes` text;--> statement-breakpoint
CREATE INDEX `customers_beneficial_owner_idx` ON `customers` (`beneficialOwnerCustomerId`);