CREATE TABLE IF NOT EXISTS `panic_alerts` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `driverId` int NOT NULL,
  `rideId` int,
  `status` enum('active','acknowledged','resolved','cancelled') NOT NULL DEFAULT 'active',
  `driverLat` decimal(10,7) NOT NULL,
  `driverLng` decimal(10,7) NOT NULL,
  `driverAddress` text,
  `dispatcherNote` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `acknowledgedAt` timestamp NULL,
  `resolvedAt` timestamp NULL,
  KEY `idx_status` (`status`),
  KEY `idx_createdAt` (`createdAt`)
);
