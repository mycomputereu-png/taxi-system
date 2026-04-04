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
