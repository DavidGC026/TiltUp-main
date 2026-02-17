<?php
require_once '../config/db.php';

header('Content-Type: application/json');

$errors = [];
$successes = [];

// 1. Add requires_payment to exams
$sql1 = "ALTER TABLE `exams` ADD COLUMN `requires_payment` TINYINT(1) NOT NULL DEFAULT 0";
if ($conn->query($sql1)) {
    $successes[] = "Added requires_payment to exams";
} else {
    if (strpos($conn->error, 'Duplicate column') !== false) {
        $successes[] = "requires_payment already exists in exams";
    } else {
        $errors[] = "requires_payment: " . $conn->error;
    }
}

// 2. Add payment_amount to exams
$sql2 = "ALTER TABLE `exams` ADD COLUMN `payment_amount` DECIMAL(10,2) NOT NULL DEFAULT 1000.00";
if ($conn->query($sql2)) {
    $successes[] = "Added payment_amount to exams";
} else {
    if (strpos($conn->error, 'Duplicate column') !== false) {
        $successes[] = "payment_amount already exists in exams";
    } else {
        $errors[] = "payment_amount: " . $conn->error;
    }
}

// 2b. Add payment_link for Conekta/other payment links (independent per exam)
$sql2b = "ALTER TABLE `exams` ADD COLUMN `payment_link` VARCHAR(500) DEFAULT NULL";
if ($conn->query($sql2b)) {
    $successes[] = "Added payment_link to exams";
} else {
    if (strpos($conn->error, 'Duplicate column') !== false) {
        $successes[] = "payment_link already exists in exams";
    } else {
        $errors[] = "payment_link: " . $conn->error;
    }
}

// 3. Set requires_payment = 1 for evaluation-type exams
$sql3 = "UPDATE `exams` e JOIN `sections` s ON e.section_id = s.id SET e.requires_payment = 1 WHERE s.type = 'evaluation'";
if ($conn->query($sql3)) {
    $successes[] = "Updated evaluation exams to require payment (affected: " . $conn->affected_rows . ")";
} else {
    $errors[] = "Update evaluation exams: " . $conn->error;
}

// 4. Add admin approval fields to user_payments
$alterFields = [
    "ALTER TABLE `user_payments` ADD COLUMN `approved_by` INT(11) DEFAULT NULL",
    "ALTER TABLE `user_payments` ADD COLUMN `approved_at` TIMESTAMP NULL DEFAULT NULL",
    "ALTER TABLE `user_payments` ADD COLUMN `admin_notes` TEXT DEFAULT NULL",
    "ALTER TABLE `user_payments` ADD COLUMN `exam_id` VARCHAR(50) DEFAULT NULL",
];

foreach ($alterFields as $sql) {
    if ($conn->query($sql)) {
        $successes[] = "Executed: " . substr($sql, 0, 60) . "...";
    } else {
        if (strpos($conn->error, 'Duplicate column') !== false) {
            $successes[] = "Column already exists: " . substr($sql, 0, 60) . "...";
        } else {
            $errors[] = substr($sql, 0, 60) . ": " . $conn->error;
        }
    }
}

// 5. Create exam_access_permissions table
$sql5 = "CREATE TABLE IF NOT EXISTS `exam_access_permissions` (
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
  CONSTRAINT `fk_exam_access_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_exam_access_exam` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_exam_access_granted_by` FOREIGN KEY (`granted_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

if ($conn->query($sql5)) {
    $successes[] = "Created exam_access_permissions table";
} else {
    $errors[] = "exam_access_permissions table: " . $conn->error;
}

echo json_encode([
    'successes' => $successes,
    'errors' => $errors,
    'status' => empty($errors) ? 'ok' : 'partial'
]);
?>
