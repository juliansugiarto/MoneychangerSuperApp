ALTER TABLE `customers` ADD `addressType` enum('RUMAH','KANTOR','DOMISILI','LAINNYA');--> statement-breakpoint
ALTER TABLE `customers` ADD `addressCountry` varchar(2);--> statement-breakpoint
ALTER TABLE `customers` ADD `addressProvince` varchar(120);--> statement-breakpoint
ALTER TABLE `customers` ADD `addressCity` varchar(120);--> statement-breakpoint
ALTER TABLE `customers` ADD `addressDistrict` varchar(120);--> statement-breakpoint
ALTER TABLE `customers` ADD `addressPostalCode` varchar(20);--> statement-breakpoint
ALTER TABLE `customers` ADD `nationality` varchar(2);--> statement-breakpoint
ALTER TABLE `customers` ADD `npwp` varchar(20);--> statement-breakpoint
ALTER TABLE `customers` ADD `gender` enum('MALE','FEMALE');