-- Migration: Add exam payment permissions system

-- 0. Create user_payments table if it doesn't exist
CREATE TABLE IF NOT EXISTS `user_payments` (
  `id` varchar(50) NOT NULL,
  `user_id` int(11) NOT NULL,
  `module_id` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT 1000.00,
  `status` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_payments_user` (`user_id`),
  KEY `idx_user_payments_module` (`module_id`),
  CONSTRAINT `fk_user_payments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1. Add requires_payment flag to exams table
ALTER TABLE `exams` ADD COLUMN IF NOT EXISTS `requires_payment` TINYINT(1) NOT NULL DEFAULT 0;

-- 2. Set requires_payment = 1 for evaluation-type exams (final exams)
UPDATE `exams` e
JOIN `sections` s ON e.section_id = s.id
SET e.requires_payment = 1
WHERE s.type = 'evaluation';

-- 3. Add payment_amount and payment_link to exams table (configurable per exam)
ALTER TABLE `exams` ADD COLUMN IF NOT EXISTS `payment_amount` DECIMAL(10,2) NOT NULL DEFAULT 1000.00;

-- 3b. Add payment_link for Conekta or other payment provider links (independent per exam)
ALTER TABLE `exams` ADD COLUMN IF NOT EXISTS `payment_link` VARCHAR(500) DEFAULT NULL;

-- 4. Ensure user_payments table has proper structure for admin approval workflow
-- The existing table already has status enum('pending','completed','failed')
-- Add admin approval fields
ALTER TABLE `user_payments` ADD COLUMN IF NOT EXISTS `approved_by` INT(11) DEFAULT NULL;
ALTER TABLE `user_payments` ADD COLUMN IF NOT EXISTS `approved_at` TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE `user_payments` ADD COLUMN IF NOT EXISTS `admin_notes` TEXT DEFAULT NULL;
ALTER TABLE `user_payments` ADD COLUMN IF NOT EXISTS `exam_id` VARCHAR(50) DEFAULT NULL;

-- 5. Create exam_access_permissions table for direct admin grants (without payment)
CREATE TABLE IF NOT EXISTS `exam_access_permissions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `exam_id` VARCHAR(50) NOT NULL,
  `granted_by` INT(11) NOT NULL,
  `granted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `revoked_at` TIMESTAMP NULL DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `notes` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_exam_access_user` (`user_id`),
  KEY `idx_exam_access_exam` (`exam_id`),
  KEY `idx_exam_access_active` (`is_active`),
  UNIQUE KEY `uk_user_exam_active` (`user_id`, `exam_id`, `is_active`),
  CONSTRAINT `fk_exam_access_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_exam_access_exam` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_exam_access_granted_by` FOREIGN KEY (`granted_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
