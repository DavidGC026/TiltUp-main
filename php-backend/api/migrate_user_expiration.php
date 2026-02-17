<?php
require_once '../config/db.php';

header('Content-Type: application/json');

$errors = [];
$successes = [];

$alterFields = [
    "ALTER TABLE `users` ADD COLUMN `email` VARCHAR(255) DEFAULT NULL",
    "ALTER TABLE `users` ADD COLUMN `display_name` VARCHAR(255) DEFAULT NULL",
    "ALTER TABLE `users` ADD COLUMN `access_expires_at` TIMESTAMP NULL DEFAULT NULL",
    "ALTER TABLE `users` ADD COLUMN `access_duration_days` INT DEFAULT NULL",
    "ALTER TABLE `users` ADD COLUMN `account_status` ENUM('active','expired','disabled','deleted') NOT NULL DEFAULT 'active'",
    "ALTER TABLE `users` ADD COLUMN `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    "ALTER TABLE `users` ADD COLUMN `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    "ALTER TABLE `users` ADD COLUMN `created_by` INT(11) DEFAULT NULL",
];

foreach ($alterFields as $sql) {
    if ($conn->query($sql)) {
        $successes[] = "OK: " . substr($sql, 0, 70) . "...";
    } else {
        if (strpos($conn->error, 'Duplicate column') !== false) {
            $successes[] = "Already exists: " . substr($sql, 0, 70) . "...";
        } else {
            $errors[] = substr($sql, 0, 70) . ": " . $conn->error;
        }
    }
}

echo json_encode([
    'successes' => $successes,
    'errors' => $errors,
    'status' => empty($errors) ? 'ok' : 'partial'
]);
?>
