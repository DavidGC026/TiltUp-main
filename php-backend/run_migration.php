<?php
require_once __DIR__ . '/config/db.php';

$sqlFile = __DIR__ . '/../sql/02_replace_gantt_with_files.sql';

if (!file_exists($sqlFile)) {
    die("SQL file not found at: $sqlFile\n");
}

$sql = file_get_contents($sqlFile);

// Split by semicolon usually works for simple dumps, but we have to be careful with stored procedures (none here)
// However, mysqli::multi_query is better for executing a script.
if ($conn->multi_query($sql)) {
    do {
        // Store first result set
        if ($result = $conn->store_result()) {
            $result->free();
        }
        // Check if there are more result sets
    } while ($conn->next_result());
    
    if ($conn->errno) {
        echo "Error execution migration: " . $conn->error . "\n";
    } else {
        echo "Migration executed successfully.\n";
    }
} else {
    echo "Error executing migration: " . $conn->error . "\n";
}

$conn->close();
?>
