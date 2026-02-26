<?php
// api/admin_results.php
require_once '../config/db.php';

session_start();

// Verify authentication and admin role
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    json_response(['error' => 'Unauthorized'], 403);
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    get_all_results();
} else {
    json_response(['error' => 'Method not allowed'], 405);
}

function get_all_results()
{
    global $conn;

    // Fetch users who have taken exams
    $query = "
        SELECT 
            u.id as user_id, 
            u.username, 
            er.id as result_id,
            er.exam_id,
            e.title as exam_title,
            er.attempt_id,
            er.score,
            er.passed,
            er.created_at,
            er.details
        FROM exam_results er
        JOIN users u ON er.user_id = u.id
        JOIN exams e ON er.exam_id = e.id
        ORDER BY er.created_at DESC
    ";

    $result = $conn->query($query);

    if (!$result) {
        json_response(['error' => $conn->error], 500);
    }

    $data = [];
    $all_question_ids = [];
    $all_option_ids = [];

    while ($row = $result->fetch_assoc()) {
        // Decode details JSON
        $details = json_decode($row['details'], true) ?: [];
        $row['details'] = $details;
        $row['passed'] = (bool) $row['passed'];
        $row['score'] = (float) $row['score'];
        $data[] = $row;
        
        foreach ($details as $detail) {
            if (!empty($detail['questionId'])) {
                $all_question_ids[$detail['questionId']] = true;
            }
            if (!empty($detail['selectedOptionId'])) {
                $all_option_ids[$detail['selectedOptionId']] = true;
            }
            if (!empty($detail['correctOptionId'])) {
                $all_option_ids[$detail['correctOptionId']] = true;
            }
        }
    }

    // Fetch question texts
    $question_texts = [];
    if (!empty($all_question_ids)) {
        $q_ids = array_keys($all_question_ids);
        $escaped_q_ids = array_map(function($id) use ($conn) {
            return "'" . $conn->real_escape_string($id) . "'";
        }, $q_ids);
        $q_in = implode(',', $escaped_q_ids);
        
        $q_res = $conn->query("SELECT id, question_text FROM exam_questions WHERE id IN ($q_in)");
        if ($q_res) {
            while ($q_row = $q_res->fetch_assoc()) {
                $question_texts[$q_row['id']] = $q_row['question_text'];
            }
        }
    }

    // Fetch option texts
    $option_texts = [];
    if (!empty($all_option_ids)) {
        $o_ids = array_keys($all_option_ids);
        $escaped_o_ids = array_map(function($id) use ($conn) {
            return "'" . $conn->real_escape_string($id) . "'";
        }, $o_ids);
        $o_in = implode(',', $escaped_o_ids);
        
        $o_res = $conn->query("SELECT id, option_text FROM exam_question_options WHERE id IN ($o_in)");
        if ($o_res) {
            while ($o_row = $o_res->fetch_assoc()) {
                $option_texts[$o_row['id']] = $o_row['option_text'];
            }
        }
    }

    // Augment data with texts
    foreach ($data as &$row) {
        foreach ($row['details'] as &$detail) {
            $qid = $detail['questionId'] ?? '';
            $detail['questionText'] = $question_texts[$qid] ?? 'Texto no encontrado';

            $sid = $detail['selectedOptionId'] ?? '';
            $detail['selectedOptionText'] = $option_texts[$sid] ?? 'No respondida / Texto no encontrado';

            $cid = $detail['correctOptionId'] ?? '';
            $detail['correctOptionText'] = $option_texts[$cid] ?? 'Texto no encontrado';
        }
    }

    json_response($data);
}
?>