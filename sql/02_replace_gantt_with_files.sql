-- Drop old Gantt tables
DROP TABLE IF EXISTS `user_gantt_data`;
DROP TABLE IF EXISTS `user_gantt_state`;
DROP TABLE IF EXISTS `module_gantt_rows`;
DROP TABLE IF EXISTS `module_gantt_pages`;

-- Create new table for module files
CREATE TABLE IF NOT EXISTS `module_files` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `module_id` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `file_path` varchar(255) NOT NULL,
  `file_type` varchar(50) NOT NULL, -- 'pdf', 'excel', etc.
  `file_size` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_module_files_module` (`module_id`),
  CONSTRAINT `fk_module_files_module` FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE module_files ADD COLUMN preview_image_path VARCHAR(255) NULL AFTER file_path;