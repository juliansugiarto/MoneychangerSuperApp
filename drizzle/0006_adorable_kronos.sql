ALTER TABLE `users` MODIFY COLUMN `role` enum('TELLER','SUPERVISOR','DIRECTOR','ADMIN','STAFF','CONTROLLER','SHAREHOLDER') NOT NULL DEFAULT 'TELLER';--> statement-breakpoint
UPDATE `users` SET `role` = CASE `role`
  WHEN 'TELLER' THEN 'STAFF'
  WHEN 'SUPERVISOR' THEN 'ADMIN'
  WHEN 'DIRECTOR' THEN 'CONTROLLER'
  WHEN 'ADMIN' THEN 'CONTROLLER'
  ELSE 'STAFF'
END;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('STAFF','ADMIN','CONTROLLER','SHAREHOLDER') NOT NULL DEFAULT 'STAFF';--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `accountStatus` enum('ACTIVE','SUSPENDED') DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `mustChangePassword` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `sessionVersion` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);
