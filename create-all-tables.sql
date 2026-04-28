-- Create dispatchers table
CREATE TABLE IF NOT EXISTS `dispatchers` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `email` varchar(320) NOT NULL UNIQUE,
  `passwordHash` varchar(256) NOT NULL,
  `name` varchar(128) NOT NULL,
  `phone` varchar(32),
  `status` enum('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NULL
);

-- Create dispatcher_sessions table
CREATE TABLE IF NOT EXISTS `dispatcher_sessions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `dispatcherId` int NOT NULL,
  `token` varchar(512) NOT NULL UNIQUE,
  `expiresAt` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
