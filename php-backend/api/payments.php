<?php
require_once '../config/db.php';
require_once 'auth.php';

header('Content-Type: application/json');

// Only execute routing if this file is called directly
if (basename($_SERVER['SCRIPT_FILENAME']) === 'payments.php') {
    $method = $_SERVER['REQUEST_METHOD'];
    $user_id = $_SESSION['user_id'] ?? 0;

    if (!$user_id) {
        json_response(['error' => 'Unauthorized'], 401);
    }

    if ($method === 'GET') {
        $module_id = $_GET['module_id'] ?? '';
        if (!$module_id) {
            json_response(['error' => 'Missing module_id'], 400);
        }
        check_payment_status($user_id, $module_id);
    } elseif ($method === 'POST') {
        $data = get_request_data();
        $module_id = $data['module_id'] ?? '';
        if (!$module_id) {
            json_response(['error' => 'Missing module_id'], 400);
        }
        process_payment($user_id, $module_id);
    } else {
        json_response(['error' => 'Method not allowed'], 405);
    }
}

function check_payment_status($user_id, $module_id)
{
    global $conn;

    // First check for completed payment
    $sql = "SELECT status FROM user_payments WHERE user_id = ? AND module_id = ? AND status = 'completed' LIMIT 1";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("is", $user_id, $module_id);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        json_response(['paid' => true, 'payment_status' => 'completed']);
        return;
    }

    // Check for direct admin permission via exam_access_permissions
    $perm_sql = "SELECT eap.id FROM exam_access_permissions eap
        JOIN exams e ON eap.exam_id = e.id
        JOIN sections s ON e.section_id = s.id
        WHERE eap.user_id = ? AND s.module_id = ? AND eap.is_active = 1
        LIMIT 1";
    $perm_stmt = $conn->prepare($perm_sql);
    if ($perm_stmt) {
        $perm_stmt->bind_param("is", $user_id, $module_id);
        $perm_stmt->execute();
        $perm_result = $perm_stmt->get_result();
        if ($perm_result->num_rows > 0) {
            json_response(['paid' => true, 'payment_status' => 'admin_granted']);
            return;
        }
    }

    // Check for pending payment
    $pending_sql = "SELECT status FROM user_payments WHERE user_id = ? AND module_id = ? AND status = 'pending' LIMIT 1";
    $pending_stmt = $conn->prepare($pending_sql);
    $pending_stmt->bind_param("is", $user_id, $module_id);
    $pending_stmt->execute();
    $pending_result = $pending_stmt->get_result();

    if ($pending_result->num_rows > 0) {
        json_response(['paid' => false, 'payment_status' => 'pending']);
        return;
    }

    // Get payment link if available
    $link_sql = "SELECT e.payment_link FROM exams e JOIN sections s ON e.section_id = s.id WHERE s.module_id = ? AND e.requires_payment = 1 LIMIT 1";
    $link_stmt = $conn->prepare($link_sql);
    $payment_link = null;
    if ($link_stmt) {
        $link_stmt->bind_param("s", $module_id);
        $link_stmt->execute();
        $link_result = $link_stmt->get_result();
        if ($link_result->num_rows > 0) {
            $link_row = $link_result->fetch_assoc();
            $payment_link = $link_row['payment_link'];
        }
    }

    json_response(['paid' => false, 'payment_status' => 'none', 'payment_link' => $payment_link]);
}

function process_payment($user_id, $module_id)
{
    global $conn;

    // Check if there's already a pending or completed payment
    $check_sql = "SELECT id, status FROM user_payments WHERE user_id = ? AND module_id = ? ORDER BY created_at DESC LIMIT 1";
    $check_stmt = $conn->prepare($check_sql);
    $check_stmt->bind_param("is", $user_id, $module_id);
    $check_stmt->execute();
    $check_result = $check_stmt->get_result();

    if ($check_result->num_rows > 0) {
        $existing = $check_result->fetch_assoc();
        if ($existing['status'] === 'completed') {
            json_response(['success' => true, 'message' => 'Payment already approved']);
            return;
        }
        if ($existing['status'] === 'pending') {
            json_response(['success' => true, 'message' => 'Payment already reported, waiting for admin approval', 'status' => 'pending']);
            return;
        }
    }

    // Create payment report with PENDING status - admin must approve
    $amount = 1000.00;
    $payment_id = uniqid('pay_');
    $status = 'pending'; // Changed: payment starts as pending, admin must approve

    $sql = "INSERT INTO user_payments (id, user_id, module_id, amount, status) VALUES (?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("sisds", $payment_id, $user_id, $module_id, $amount, $status);

    if ($stmt->execute()) {
        json_response([
            'success' => true,
            'message' => 'Payment reported successfully. Awaiting admin approval.',
            'status' => 'pending'
        ]);
    } else {
        json_response(['error' => 'Payment report failed: ' . $conn->error], 500);
    }
}
?>