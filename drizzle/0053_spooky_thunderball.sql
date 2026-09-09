CREATE TABLE `ira_parameter_thresholds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parameterCode` varchar(40) NOT NULL,
	`bandIndex` int NOT NULL,
	`upperBoundPercent` decimal(6,2),
	`updatedByUserId` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ira_parameter_thresholds_id` PRIMARY KEY(`id`),
	CONSTRAINT `ira_parameter_thresholds_band_uq` UNIQUE(`parameterCode`,`bandIndex`)
);
--> statement-breakpoint
CREATE TABLE `ira_risk_classifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dimension` enum('CURRENCY','OCCUPATION','LEGAL_FORM','COUNTRY','PROVINCE') NOT NULL,
	`code` varchar(60) NOT NULL,
	`riskType` enum('TPPU','TPPT','PPSPM') NOT NULL,
	`level` enum('RENDAH','MENENGAH','TINGGI') NOT NULL,
	`sourceNote` text NOT NULL,
	`updatedByUserId` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ira_risk_classifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `ira_risk_classifications_key_uq` UNIQUE(`dimension`,`code`,`riskType`)
);
--> statement-breakpoint
ALTER TABLE `company_profile` ADD `province` varchar(60);--> statement-breakpoint
ALTER TABLE `customers` ADD `customerType` enum('INDIVIDU','BADAN_USAHA');--> statement-breakpoint
ALTER TABLE `customers` ADD `entityLegalForm` enum('PT','PERUSAHAAN_PERSEORANGAN','SOCIAL_ENTERPRISE','CV','FIRMA','PERSEKUTUAN_PERDATA','KOPERASI','YAYASAN','PERKUMPULAN','ORMAS_TERDAFTAR','ORMAS_TIDAK_TERDAFTAR');--> statement-breakpoint
ALTER TABLE `customers` ADD `occupationCategory` enum('PEJABAT_NEGARA','WIRAUSAHA','KARYAWAN_SWASTA','PNS_ASN','PROFESI_KEUANGAN_LAINNYA','PROFESIONAL','PEGAWAI_BUMN_BUMD_BUMS_BUMDES','IBU_RUMAH_TANGGA','TNI','POLRI','PELAJAR_MAHASISWA','PENGURUS_YAYASAN_PERKUMPULAN','ARTIS_CONTENT_CREATOR_INFLUENCER','PENGAJAR','ORMAS_LSM','SOPIR','ASISTEN_RUMAH_TANGGA','BURUH','TENAGA_KEAMANAN','ATLET','PEMUKA_AGAMA','PENGURUS_PARTAI_POLITIK','LAINNYA');--> statement-breakpoint
ALTER TABLE `exchange_transactions` ADD `distributionChannel` enum('KANTOR','LAYANAN_DELIVERY','ONLINE_MERCHANT') DEFAULT 'KANTOR' NOT NULL;--> statement-breakpoint
CREATE INDEX `ira_risk_classifications_dimension_idx` ON `ira_risk_classifications` (`dimension`,`riskType`);