CREATE TABLE `dispatcher_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dispatcherId` int NOT NULL,
	`token` varchar(512) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dispatcher_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `dispatcher_sessions_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `dispatchers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(256) NOT NULL,
	`name` varchar(128) NOT NULL,
	`phone` varchar(32),
	`status` enum('active','inactive','suspended') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp,
	CONSTRAINT `dispatchers_id` PRIMARY KEY(`id`),
	CONSTRAINT `dispatchers_email_unique` UNIQUE(`email`)
);
