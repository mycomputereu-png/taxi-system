CREATE TABLE IF NOT EXISTS `dispatchers` (
  `id` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `passwordHash` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `phone` varchar(191),
  `status` varchar(191) NOT NULL DEFAULT 'active',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `lastSignedIn` datetime(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `dispatchers_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dispatcher_sessions` (
  `id` varchar(191) NOT NULL,
  `dispatcherId` varchar(191) NOT NULL,
  `token` varchar(191) NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `dispatcher_sessions_token_key` (`token`),
  KEY `dispatcher_sessions_dispatcherId_idx` (`dispatcherId`),
  CONSTRAINT `dispatcher_sessions_dispatcherId_fkey` FOREIGN KEY (`dispatcherId`) REFERENCES `dispatchers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `dispatchers` (`id`, `email`, `passwordHash`, `name`, `phone`, `status`, `createdAt`, `updatedAt`, `lastSignedIn`)
VALUES ('disp_001', 'lazareanu_mihai@yahoo.com', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'Mihai Lazareanu', '+40123456789', 'active', NOW(), NOW(), NULL)
ON DUPLICATE KEY UPDATE email=VALUES(email);
