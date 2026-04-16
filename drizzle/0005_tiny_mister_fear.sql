ALTER TABLE `drivers` ADD `carPlate` varchar(32);--> statement-breakpoint
ALTER TABLE `drivers` ADD `carBrand` varchar(128);--> statement-breakpoint
ALTER TABLE `rides` ADD `assignedAt` timestamp;--> statement-breakpoint
ALTER TABLE `rides` ADD `acceptanceTimeoutAt` timestamp;