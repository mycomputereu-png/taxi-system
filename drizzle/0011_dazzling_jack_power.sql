CREATE TABLE `client_ratings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`driverId` int NOT NULL,
	`rideId` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_ratings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`token` varchar(512) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_sessions_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(32) NOT NULL,
	`name` varchar(128),
	`currentLat` decimal(10,7),
	`currentLng` decimal(10,7),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `clients_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `driver_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driverId` int NOT NULL,
	`token` varchar(512) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `driver_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `driver_sessions_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `drivers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`passwordHash` varchar(256) NOT NULL,
	`name` varchar(128) NOT NULL,
	`phone` varchar(32),
	`carPlate` varchar(32),
	`carBrand` varchar(128),
	`status` enum('available','busy','offline') NOT NULL DEFAULT 'offline',
	`currentLat` decimal(10,7),
	`currentLng` decimal(10,7),
	`lastLocationUpdate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `drivers_id` PRIMARY KEY(`id`),
	CONSTRAINT `drivers_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `otp_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(32) NOT NULL,
	`code` varchar(6) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`used` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `otp_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `panic_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driverId` int NOT NULL,
	`rideId` int,
	`status` enum('active','acknowledged','resolved','cancelled') NOT NULL DEFAULT 'active',
	`driverLat` decimal(10,7) NOT NULL,
	`driverLng` decimal(10,7) NOT NULL,
	`driverAddress` text,
	`dispatcherNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`acknowledgedAt` timestamp,
	`resolvedAt` timestamp,
	CONSTRAINT `panic_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`driverId` int,
	`status` enum('pending','assigned','accepted','in_progress','completed','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`clientLat` decimal(10,7) NOT NULL,
	`clientLng` decimal(10,7) NOT NULL,
	`clientAddress` text,
	`destinationLat` decimal(10,7),
	`destinationLng` decimal(10,7),
	`destinationAddress` text,
	`estimatedArrival` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`acceptedAt` timestamp,
	`completedAt` timestamp,
	`assignedAt` timestamp,
	`acceptanceTimeoutAt` timestamp,
	`distance_km` decimal(8,2),
	`revenue` decimal(10,2),
	CONSTRAINT `rides_id` PRIMARY KEY(`id`)
);
