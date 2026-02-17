<?php
/**
 * API: Exam Payment Permissions Management
 * 
 * Endpoints:
 * GET ?action=check&exam_id=X          - Check if current user has permission for exam
 * GET ?action=check&exam_id=X&user_id=Y - Admin: check specific user permission
 * GET ?action=list                      - Admin: list all permissions/pending payments
 * GET ?action=users                     - Admin: list all non-admin users
 * POST action=grant                     - Admin: grant exam access to user
 * POST action=revoke                    - Admin: revoke exam access
 * POST action=approve_payment           - Admin: approve a pending payment
 * POST action=reject_payment            - Admin: reject a pending payment
 */

require_once '../config/db.php';

session_start();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? ($_POST['action'] ?? '');

if ($method === 'POST') {
    $data = get_request_data();
    $action = $data['action'] ?? $action;
}

$user_id = $_SESSION['user_id'] ?? 0;
$user_role = $_SESSION['role'] ?? 'user';

if (!$user_id) {
    json_response(['error' => 'Unauthorized'], 401);
}

switch ($method) {
    case 'GET':
        switch ($action) {
            case 'check':
                handle_check_permission();
                break;
            case 'list':
                require_admin();
                handle_list_permissions();
                break;
            case 'users':
                require_admin();
                handle_list_users();
                break;
            case 'exams':
                require_admin();
                handle_list_exams();
                break;
            default:
                json_response(['error' => 'Invalid action'], 400);
        }
        break;
    case 'POST':
        require_admin();
        $data = get_request_data();
        switch ($action) {
            case 'grant':
                handle_grant_permission($data);
                break;
            case 'revoke':
                handle_revoke_permission($data);
                break;
            case 'approve_payment':
                handle_approve_payment($data);
                break;
            case 'reject_payment':
                handle_reject_payment($data);
                break;
            case 'update_exam':
                handle_update_exam($data);
                break;
            default:
                json_response(['error' => 'Invalid action'], 400);
        }
        break;
    default:
        json_response(['error' => 'Method not allowed'], 405);
}

function require_admin() {
    global $user_role;
    if ($user_role !== 'admin') {
        json_response(['error' => 'Forbidden: Admin access required'], 403);
    }
}

/**
 * Check if a user has permission to take an exam
 * Permission is granted if:
 * 1. The exam does not require payment (requires_payment = 0)
 * 2. User has an active entry in exam_access_permissions
 * 3. User has a completed payment in user_payments for the module/exam
 */
function handle_check_permission() {
    global $conn, $user_id, $user_role;

    $exam_id = $_GET['exam_id'] ?? '';
    $check_user_id = $_GET['user_id'] ?? $user_id;

    // Non-admins can only check their own permission
    if ($user_role !== 'admin' && (int)$check_user_id !== (int)$user_id) {
        json_response(['error' => 'Forbidden'], 403);
    }

    if (!$exam_id) {
        json_response(['error' => 'exam_id required'], 400);
    }

    $exam_id_escaped = $conn->real_escape_string($exam_id);
    $check_user_id = (int)$check_user_id;

    // Check if exam requires payment
    $res = $conn->query("SELECT id, requires_payment, payment_amount, payment_link, section_id FROM exams WHERE id = '$exam_id_escaped' LIMIT 1");
    if (!$res || $res->num_rows === 0) {
        json_response(['error' => 'Exam not found'], 404);
    }
    $exam = $res->fetch_assoc();

    // Admin always has access
    if ($user_role === 'admin') {
        json_response([
            'has_permission' => true,
            'requires_payment' => (bool)$exam['requires_payment'],
            'payment_amount' => (float)$exam['payment_amount'],
            'reason' => 'admin'
        ]);
    }

    // If exam doesn't require payment, grant access
    if (!$exam['requires_payment']) {
        json_response([
            'has_permission' => true,
            'requires_payment' => false,
            'payment_amount' => 0,
            'reason' => 'no_payment_required'
        ]);
    }

    // Check direct admin grant in exam_access_permissions
    $perm_res = $conn->query(
        "SELECT id FROM exam_access_permissions 
         WHERE user_id = $check_user_id AND exam_id = '$exam_id_escaped' AND is_active = 1 
         LIMIT 1"
    );
    if ($perm_res && $perm_res->num_rows > 0) {
        json_response([
            'has_permission' => true,
            'requires_payment' => true,
            'payment_amount' => (float)$exam['payment_amount'],
            'reason' => 'admin_granted'
        ]);
    }

    // Check completed payment for the module
    $section_id = $conn->real_escape_string($exam['section_id']);
    $section_res = $conn->query("SELECT module_id FROM sections WHERE id = '$section_id' LIMIT 1");
    $module_id = '';
    if ($section_res && $row = $section_res->fetch_assoc()) {
        $module_id = $conn->real_escape_string($row['module_id']);
    }

    if ($module_id) {
        $pay_res = $conn->query(
            "SELECT id FROM user_payments 
             WHERE user_id = $check_user_id AND module_id = '$module_id' AND status = 'completed' 
             LIMIT 1"
        );
        if ($pay_res && $pay_res->num_rows > 0) {
            json_response([
                'has_permission' => true,
                'requires_payment' => true,
                'payment_amount' => (float)$exam['payment_amount'],
                'reason' => 'payment_completed'
            ]);
        }

        // Check if there's a pending payment
        $pending_res = $conn->query(
            "SELECT id FROM user_payments 
             WHERE user_id = $check_user_id AND module_id = '$module_id' AND status = 'pending' 
             LIMIT 1"
        );
        if ($pending_res && $pending_res->num_rows > 0) {
            json_response([
                'has_permission' => false,
                'requires_payment' => true,
                'payment_amount' => (float)$exam['payment_amount'],
                'payment_status' => 'pending',
                'reason' => 'payment_pending_approval'
            ]);
        }
    }

    json_response([
        'has_permission' => false,
        'requires_payment' => true,
        'payment_amount' => (float)$exam['payment_amount'],
        'payment_status' => 'none',
        'reason' => 'no_payment'
    ]);
}

/**
 * Admin: List all permissions and pending payments
 */
function handle_list_permissions() {
    global $conn;

    // Get all exam access permissions
    $permissions = [];
    $res = $conn->query("
        SELECT 
            eap.id,
            eap.user_id,
            u.username,
            eap.exam_id,
            e.title as exam_title,
            s.module_id,
            m.title as module_title,
            eap.granted_by,
            admin_u.username as granted_by_username,
            eap.granted_at,
            eap.is_active,
            eap.notes
        FROM exam_access_permissions eap
        JOIN users u ON eap.user_id = u.id
        JOIN exams e ON eap.exam_id = e.id
        JOIN sections s ON e.section_id = s.id
        JOIN modules m ON s.module_id = m.id
        JOIN users admin_u ON eap.granted_by = admin_u.id
        ORDER BY eap.granted_at DESC
    ");

    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $row['is_active'] = (bool)$row['is_active'];
            $permissions[] = $row;
        }
    }

    // Get all pending payments
    $pending_payments = [];
    $pay_res = $conn->query("
        SELECT 
            up.id,
            up.user_id,
            u.username,
            up.module_id,
            m.title as module_title,
            up.exam_id,
            up.amount,
            up.status,
            up.created_at,
            up.approved_by,
            up.approved_at,
            up.admin_notes
        FROM user_payments up
        JOIN users u ON up.user_id = u.id
        LEFT JOIN modules m ON up.module_id = m.id
        ORDER BY 
            CASE up.status 
                WHEN 'pending' THEN 0 
                WHEN 'completed' THEN 1 
                ELSE 2 
            END,
            up.created_at DESC
    ");

    if ($pay_res) {
        while ($row = $pay_res->fetch_assoc()) {
            $row['amount'] = (float)$row['amount'];
            $pending_payments[] = $row;
        }
    }

    // Get exams that require payment
    $exams_requiring_payment = [];
    $exam_res = $conn->query("
        SELECT 
            e.id,
            e.title,
            e.requires_payment,
            e.payment_amount,
            e.section_id,
            s.module_id,
            m.title as module_title
        FROM exams e
        JOIN sections s ON e.section_id = s.id
        JOIN modules m ON s.module_id = m.id
        WHERE e.requires_payment = 1
        ORDER BY m.number ASC
    ");

    if ($exam_res) {
        while ($row = $exam_res->fetch_assoc()) {
            $row['requires_payment'] = (bool)$row['requires_payment'];
            $row['payment_amount'] = (float)$row['payment_amount'];
            $exams_requiring_payment[] = $row;
        }
    }

    json_response([
        'permissions' => $permissions,
        'payments' => $pending_payments,
        'exams_requiring_payment' => $exams_requiring_payment
    ]);
}

/**
 * Admin: List all non-admin users
 */
function handle_list_users() {
    global $conn;
    $res = $conn->query("SELECT id, username, role FROM users WHERE role != 'admin' ORDER BY username ASC");
    $users = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $users[] = $row;
        }
    }
    json_response($users);
}

/**
 * Admin: List all exams (with payment info)
 */
function handle_list_exams() {
    global $conn;
    $res = $conn->query("
        SELECT 
            e.id,
            e.title,
            e.requires_payment,
            e.payment_amount,
            e.payment_link,
            e.section_id,
            s.module_id,
            s.type as section_type,
            m.title as module_title,
            m.number as module_number
        FROM exams e
        JOIN sections s ON e.section_id = s.id
        JOIN modules m ON s.module_id = m.id
        ORDER BY m.number ASC, s.`order` ASC
    ");
    $exams = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $row['requires_payment'] = (bool)$row['requires_payment'];
            $row['payment_amount'] = (float)$row['payment_amount'];
            $exams[] = $row;
        }
    }
    json_response($exams);
}

/**
 * Admin: Grant exam access permission to user
 */
function handle_grant_permission($data) {
    global $conn, $user_id;

    $target_user_id = (int)($data['user_id'] ?? 0);
    $exam_id = $data['exam_id'] ?? '';
    $notes = $data['notes'] ?? '';

    if (!$target_user_id || !$exam_id) {
        json_response(['error' => 'user_id and exam_id required'], 400);
    }

    $exam_id_escaped = $conn->real_escape_string($exam_id);
    $notes_escaped = $conn->real_escape_string($notes);

    // Check if permission already exists and is active
    $existing = $conn->query(
        "SELECT id FROM exam_access_permissions 
         WHERE user_id = $target_user_id AND exam_id = '$exam_id_escaped' AND is_active = 1"
    );

    if ($existing && $existing->num_rows > 0) {
        json_response(['message' => 'Permission already exists', 'already_exists' => true]);
        return;
    }

    $stmt = $conn->prepare(
        "INSERT INTO exam_access_permissions (user_id, exam_id, granted_by, notes) VALUES (?, ?, ?, ?)"
    );
    $stmt->bind_param("isis", $target_user_id, $exam_id, $user_id, $notes);

    if ($stmt->execute()) {
        json_response(['success' => true, 'message' => 'Permission granted successfully', 'id' => $conn->insert_id]);
    } else {
        json_response(['error' => 'Failed to grant permission: ' . $conn->error], 500);
    }
}

/**
 * Admin: Revoke exam access permission
 */
function handle_revoke_permission($data) {
    global $conn;

    $permission_id = (int)($data['permission_id'] ?? 0);
    $target_user_id = (int)($data['user_id'] ?? 0);
    $exam_id = $data['exam_id'] ?? '';

    if ($permission_id) {
        // Revoke by ID
        $stmt = $conn->prepare(
            "UPDATE exam_access_permissions SET is_active = 0, revoked_at = NOW() WHERE id = ?"
        );
        $stmt->bind_param("i", $permission_id);
    } elseif ($target_user_id && $exam_id) {
        // Revoke by user_id + exam_id
        $stmt = $conn->prepare(
            "UPDATE exam_access_permissions SET is_active = 0, revoked_at = NOW() WHERE user_id = ? AND exam_id = ? AND is_active = 1"
        );
        $stmt->bind_param("is", $target_user_id, $exam_id);
    } else {
        json_response(['error' => 'permission_id or (user_id + exam_id) required'], 400);
    }

    if ($stmt->execute()) {
        json_response(['success' => true, 'message' => 'Permission revoked']);
    } else {
        json_response(['error' => 'Failed to revoke: ' . $conn->error], 500);
    }
}

/**
 * Admin: Approve a pending payment
 */
function handle_approve_payment($data) {
    global $conn, $user_id;

    $payment_id = $data['payment_id'] ?? '';
    $notes = $data['notes'] ?? '';

    if (!$payment_id) {
        json_response(['error' => 'payment_id required'], 400);
    }

    $payment_id_escaped = $conn->real_escape_string($payment_id);
    $notes_escaped = $conn->real_escape_string($notes);

    $result = $conn->query(
        "UPDATE user_payments 
         SET status = 'completed', approved_by = $user_id, approved_at = NOW(), admin_notes = '$notes_escaped' 
         WHERE id = '$payment_id_escaped' AND status = 'pending'"
    );

    if ($result && $conn->affected_rows > 0) {
        json_response(['success' => true, 'message' => 'Payment approved']);
    } else {
        json_response(['error' => 'Payment not found or already processed'], 400);
    }
}

/**
 * Admin: Reject a pending payment
 */
function handle_reject_payment($data) {
    global $conn, $user_id;

    $payment_id = $data['payment_id'] ?? '';
    $notes = $data['notes'] ?? '';

    if (!$payment_id) {
        json_response(['error' => 'payment_id required'], 400);
    }

    $payment_id_escaped = $conn->real_escape_string($payment_id);
    $notes_escaped = $conn->real_escape_string($notes);

    $result = $conn->query(
        "UPDATE user_payments 
         SET status = 'failed', approved_by = $user_id, approved_at = NOW(), admin_notes = '$notes_escaped' 
         WHERE id = '$payment_id_escaped' AND status = 'pending'"
    );

    if ($result && $conn->affected_rows > 0) {
        json_response(['success' => true, 'message' => 'Payment rejected']);
    } else {
        json_response(['error' => 'Payment not found or already processed'], 400);
    }
}

/**
 * Admin: Update exam payment settings (requires_payment, payment_amount, payment_link)
 */
function handle_update_exam($data) {
    global $conn;

    $exam_id = $data['exam_id'] ?? '';
    if (!$exam_id) {
        json_response(['error' => 'exam_id required'], 400);
    }

    $exam_id_escaped = $conn->real_escape_string($exam_id);
    $updates = [];

    if (isset($data['requires_payment'])) {
        $val = $data['requires_payment'] ? 1 : 0;
        $updates[] = "requires_payment = $val";
    }
    if (isset($data['payment_amount'])) {
        $val = (float)$data['payment_amount'];
        $updates[] = "payment_amount = $val";
    }
    if (array_key_exists('payment_link', $data)) {
        $val = $data['payment_link'];
        if ($val === null || $val === '') {
            $updates[] = "payment_link = NULL";
        } else {
            $val_escaped = $conn->real_escape_string($val);
            $updates[] = "payment_link = '$val_escaped'";
        }
    }

    if (empty($updates)) {
        json_response(['error' => 'No fields to update'], 400);
    }

    $set_clause = implode(', ', $updates);
    $result = $conn->query("UPDATE exams SET $set_clause WHERE id = '$exam_id_escaped'");

    if ($result) {
        json_response(['success' => true, 'message' => 'Exam updated successfully']);
    } else {
        json_response(['error' => 'Update failed: ' . $conn->error], 500);
    }
}
?>
