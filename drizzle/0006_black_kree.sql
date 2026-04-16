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
