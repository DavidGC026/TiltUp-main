-- Migration: Add user access expiration and management fields

-- Add expiration and status fields to users table
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `email` VARCHAR(255) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `display_name` VARCHAR(255) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `access_expires_at` TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `access_duration_days` INT DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `account_status` ENUM('active','expired','disabled','deleted') NOT NULL DEFAULT 'active';
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `created_by` INT(11) DEFAULT NULL;
