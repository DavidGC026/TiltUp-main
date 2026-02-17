<?php
/**
 * API: User Management (Admin)
 * 
 * GET  ?action=list                  - List all users with status
 * GET  ?action=get&user_id=X         - Get single user details
 * POST action=create                 - Create new user with access duration
 * POST action=update                 - Update user info
 * POST action=extend_access          - Extend/modify access duration
 * POST action=toggle_status          - Enable/disable account
 * POST action=delete                 - Soft-delete user
 * POST action=renew                  - Renew with same original duration
 */

require_once '../config/db.php';

if (session_status() === PHP_SESSION_NONE) {
    $is_secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';
    session_set_cookie_params([
        'lifetime' => 86400,
        'path' => '/',
        'domain' => '',
        'secure' => $is_secure,
        'httponly' => true,
        'samesite' => $is_secure ? 'None' : 'Lax'
    ]);
    session_start();
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'POST') {
    $data = get_request_data();
    $action = $data['action'] ?? $action;
}

// Require admin
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    json_response(['error' => 'Unauthorized: Admin access required'], 403);
}

$admin_id = $_SESSION['user_id'];

switch ($method) {
    case 'GET':
        switch ($action) {
            case 'list':
                handle_list_users();
                break;
            case 'get':
                handle_get_user();
                break;
            default:
                json_response(['error' => 'Invalid action'], 400);
        }
        break;
    case 'POST':
        $data = get_request_data();
        switch ($action) {
            case 'create':
                handle_create_user($data);
                break;
            case 'update':
                handle_update_user($data);
                break;
            case 'extend_access':
                handle_extend_access($data);
                break;
            case 'toggle_status':
                handle_toggle_status($data);
                break;
            case 'delete':
                handle_delete_user($data);
                break;
            case 'renew':
                handle_renew_access($data);
                break;
            default:
                json_response(['error' => 'Invalid action'], 400);
        }
        break;
    default:
        json_response(['error' => 'Method not allowed'], 405);
}

/**
 * Auto-expire users whose access_expires_at has passed
 */
function auto_expire_users() {
    global $conn;
    $conn->query("UPDATE users SET account_status = 'expired' WHERE access_expires_at IS NOT NULL AND access_expires_at < NOW() AND account_status = 'active' AND role != 'admin'");
}

/**
 * List all users with computed status
 */
function handle_list_users() {
    global $conn;

    // First auto-expire
    auto_expire_users();

    $res = $conn->query("
        SELECT 
            id, username, email, display_name, role,
            access_expires_at, access_duration_days,
            account_status, created_at, updated_at, created_by
        FROM users
        WHERE account_status != 'deleted'
        ORDER BY created_at DESC
    ");

    $users = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            // Compute time remaining
            $row['access_duration_days'] = $row['access_duration_days'] !== null ? (int)$row['access_duration_days'] : null;
            
            if ($row['access_expires_at']) {
                $expires = new DateTime($row['access_expires_at']);
                $now = new DateTime();
                if ($expires > $now) {
                    $diff = $now->diff($expires);
                    $row['time_remaining_seconds'] = ($diff->days * 86400) + ($diff->h * 3600) + ($diff->i * 60) + $diff->s;
                    $row['time_remaining_text'] = format_time_remaining($diff);
                    
                    // Calculate percentage remaining
                    if ($row['access_duration_days'] && $row['access_duration_days'] > 0) {
                        $total_seconds = $row['access_duration_days'] * 86400;
                        $row['time_remaining_percent'] = round(($row['time_remaining_seconds'] / $total_seconds) * 100, 1);
                    } else {
                        $row['time_remaining_percent'] = 100;
                    }
                } else {
                    $row['time_remaining_seconds'] = 0;
                    $row['time_remaining_text'] = 'Expirado';
                    $row['time_remaining_percent'] = 0;
                }
            } else {
                // No expiration = permanent
                $row['time_remaining_seconds'] = null;
                $row['time_remaining_text'] = 'Permanente';
                $row['time_remaining_percent'] = 100;
            }

            $users[] = $row;
        }
    }

    json_response($users);
}

function format_time_remaining($diff) {
    if ($diff->y > 0) return $diff->y . ' año' . ($diff->y > 1 ? 's' : '') . ', ' . $diff->m . ' mes' . ($diff->m > 1 ? 'es' : '');
    if ($diff->m > 0) return $diff->m . ' mes' . ($diff->m > 1 ? 'es' : '') . ', ' . $diff->d . ' día' . ($diff->d > 1 ? 's' : '');
    if ($diff->d > 0) return $diff->d . ' día' . ($diff->d > 1 ? 's' : '') . ', ' . $diff->h . 'h';
    if ($diff->h > 0) return $diff->h . 'h ' . $diff->i . 'min';
    return $diff->i . ' min';
}

/**
 * Get single user
 */
function handle_get_user() {
    global $conn;
    $user_id = (int)($_GET['user_id'] ?? 0);
    if (!$user_id) {
        json_response(['error' => 'user_id required'], 400);
    }

    $stmt = $conn->prepare("SELECT id, username, email, display_name, role, access_expires_at, access_duration_days, account_status, created_at FROM users WHERE id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();

    if (!$user) {
        json_response(['error' => 'User not found'], 404);
    }

    json_response($user);
}

/**
 * Create new user with access duration
 */
function handle_create_user($data) {
    global $conn, $admin_id;

    $username = trim($data['username'] ?? '');
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';
    $display_name = trim($data['display_name'] ?? '');
    $role = $data['role'] ?? 'user';
    $duration_days = isset($data['duration_days']) ? (int)$data['duration_days'] : null;

    if (!$username || !$password) {
        json_response(['error' => 'Username and password are required'], 400);
    }

    if (strlen($password) < 4) {
        json_response(['error' => 'Password must be at least 4 characters'], 400);
    }

    // Check username uniqueness
    $check = $conn->prepare("SELECT id FROM users WHERE username = ?");
    $check->bind_param("s", $username);
    $check->execute();
    if ($check->get_result()->num_rows > 0) {
        json_response(['error' => 'Username already exists'], 409);
    }

    // Check email uniqueness if provided
    if ($email) {
        $check_email = $conn->prepare("SELECT id FROM users WHERE email = ?");
        $check_email->bind_param("s", $email);
        $check_email->execute();
        if ($check_email->get_result()->num_rows > 0) {
            json_response(['error' => 'Email already in use'], 409);
        }
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);

    // Calculate expiration date
    $expires_at = null;
    if ($duration_days !== null && $duration_days > 0) {
        $expires = new DateTime();
        $expires->modify("+{$duration_days} days");
        $expires_at = $expires->format('Y-m-d H:i:s');
    }
    // duration_days = 0 or null means permanent

    $stmt = $conn->prepare(
        "INSERT INTO users (username, password, email, display_name, role, access_expires_at, access_duration_days, account_status, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)"
    );
    $stmt->bind_param("ssssssii", $username, $hash, $email, $display_name, $role, $expires_at, $duration_days, $admin_id);

    if ($stmt->execute()) {
        json_response([
            'success' => true,
            'message' => 'User created successfully',
            'user_id' => $conn->insert_id,
            'access_expires_at' => $expires_at
        ], 201);
    } else {
        json_response(['error' => 'Failed to create user: ' . $conn->error], 500);
    }
}

/**
 * Update user info (name, email, role)
 */
function handle_update_user($data) {
    global $conn;

    $user_id = (int)($data['user_id'] ?? 0);
    if (!$user_id) {
        json_response(['error' => 'user_id required'], 400);
    }

    $updates = [];
    $types = '';
    $values = [];

    if (isset($data['display_name'])) {
        $updates[] = "display_name = ?";
        $types .= 's';
        $values[] = $data['display_name'];
    }
    if (isset($data['email'])) {
        $updates[] = "email = ?";
        $types .= 's';
        $values[] = $data['email'];
    }
    if (isset($data['role'])) {
        $updates[] = "role = ?";
        $types .= 's';
        $values[] = $data['role'];
    }
    if (isset($data['password']) && !empty($data['password'])) {
        $updates[] = "password = ?";
        $types .= 's';
        $values[] = password_hash($data['password'], PASSWORD_DEFAULT);
    }

    if (empty($updates)) {
        json_response(['error' => 'No fields to update'], 400);
    }

    $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?";
    $types .= 'i';
    $values[] = $user_id;

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$values);

    if ($stmt->execute()) {
        json_response(['success' => true, 'message' => 'User updated']);
    } else {
        json_response(['error' => 'Update failed: ' . $conn->error], 500);
    }
}

/**
 * Extend or modify access duration
 */
function handle_extend_access($data) {
    global $conn;

    $user_id = (int)($data['user_id'] ?? 0);
    $duration_days = isset($data['duration_days']) ? (int)$data['duration_days'] : null;
    $from_now = $data['from_now'] ?? true; // If true, extend from now; if false, extend from current expiry

    if (!$user_id) {
        json_response(['error' => 'user_id required'], 400);
    }

    if ($duration_days === null) {
        json_response(['error' => 'duration_days required'], 400);
    }

    // duration_days = 0 means permanent (remove expiration)
    if ($duration_days === 0) {
        $stmt = $conn->prepare("UPDATE users SET access_expires_at = NULL, access_duration_days = NULL, account_status = 'active' WHERE id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        json_response(['success' => true, 'message' => 'Access set to permanent', 'access_expires_at' => null]);
        return;
    }

    // Calculate new expiration
    if ($from_now) {
        $expires = new DateTime();
    } else {
        // Get current expiration
        $stmt = $conn->prepare("SELECT access_expires_at FROM users WHERE id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        
        if ($row && $row['access_expires_at']) {
            $expires = new DateTime($row['access_expires_at']);
            // If already expired, start from now
            if ($expires < new DateTime()) {
                $expires = new DateTime();
            }
        } else {
            $expires = new DateTime();
        }
    }

    $expires->modify("+{$duration_days} days");
    $expires_str = $expires->format('Y-m-d H:i:s');

    $stmt = $conn->prepare("UPDATE users SET access_expires_at = ?, access_duration_days = ?, account_status = 'active' WHERE id = ?");
    $stmt->bind_param("sii", $expires_str, $duration_days, $user_id);

    if ($stmt->execute()) {
        json_response(['success' => true, 'message' => 'Access extended', 'access_expires_at' => $expires_str]);
    } else {
        json_response(['error' => 'Failed: ' . $conn->error], 500);
    }
}

/**
 * Toggle user account status (active/disabled)
 */
function handle_toggle_status($data) {
    global $conn;

    $user_id = (int)($data['user_id'] ?? 0);
    $new_status = $data['status'] ?? '';

    if (!$user_id || !in_array($new_status, ['active', 'disabled'])) {
        json_response(['error' => 'user_id and valid status (active/disabled) required'], 400);
    }

    $stmt = $conn->prepare("UPDATE users SET account_status = ? WHERE id = ? AND role != 'admin'");
    $stmt->bind_param("si", $new_status, $user_id);

    if ($stmt->execute() && $conn->affected_rows > 0) {
        json_response(['success' => true, 'message' => "Account status changed to $new_status"]);
    } else {
        json_response(['error' => 'Failed or user is admin'], 400);
    }
}

/**
 * Soft-delete user
 */
function handle_delete_user($data) {
    global $conn;

    $user_id = (int)($data['user_id'] ?? 0);
    if (!$user_id) {
        json_response(['error' => 'user_id required'], 400);
    }

    // Prevent deleting admin users
    $check = $conn->prepare("SELECT role FROM users WHERE id = ?");
    $check->bind_param("i", $user_id);
    $check->execute();
    $row = $check->get_result()->fetch_assoc();

    if (!$row) {
        json_response(['error' => 'User not found'], 404);
    }
    if ($row['role'] === 'admin') {
        json_response(['error' => 'Cannot delete admin users'], 403);
    }

    $stmt = $conn->prepare("UPDATE users SET account_status = 'deleted' WHERE id = ?");
    $stmt->bind_param("i", $user_id);

    if ($stmt->execute()) {
        json_response(['success' => true, 'message' => 'User deleted']);
    } else {
        json_response(['error' => 'Delete failed: ' . $conn->error], 500);
    }
}

/**
 * Renew access with same original duration
 */
function handle_renew_access($data) {
    global $conn;

    $user_id = (int)($data['user_id'] ?? 0);
    if (!$user_id) {
        json_response(['error' => 'user_id required'], 400);
    }

    // Get original duration
    $stmt = $conn->prepare("SELECT access_duration_days FROM users WHERE id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();

    if (!$row) {
        json_response(['error' => 'User not found'], 404);
    }

    $duration = (int)($row['access_duration_days'] ?? 0);
    if ($duration <= 0) {
        json_response(['error' => 'No original duration set for this user'], 400);
    }

    $expires = new DateTime();
    $expires->modify("+{$duration} days");
    $expires_str = $expires->format('Y-m-d H:i:s');

    $stmt = $conn->prepare("UPDATE users SET access_expires_at = ?, account_status = 'active' WHERE id = ?");
    $stmt->bind_param("si", $expires_str, $user_id);

    if ($stmt->execute()) {
        json_response(['success' => true, 'message' => "Access renewed for $duration days", 'access_expires_at' => $expires_str]);
    } else {
        json_response(['error' => 'Renew failed: ' . $conn->error], 500);
    }
}
?>
