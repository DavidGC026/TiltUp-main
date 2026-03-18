<?php
require_once '../config/db.php';

// Ensure user is logged in
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    json_response(['error' => 'No autorizado'], 401);
}

$userId = $_SESSION['user_id'];
// Check if user is admin for uploads
// Assuming 'role' is stored in session or we fetch it. 
// For now, let's fetch user role to be safe if it's not in session
$stmt = $conn->prepare("SELECT role FROM users WHERE id = ?");
$stmt->bind_param("i", $userId);
$stmt->execute();
$userResult = $stmt->get_result();
$userRow = $userResult->fetch_assoc();
$isAdmin = ($userRow && $userRow['role'] === 'admin');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $module_id = $_GET['module_id'] ?? null;

    if (!$module_id) {
        json_response(['error' => 'module_id required'], 400);
    }

    // Fetch Global Files (user_id IS NULL) + Personal Files (user_id = $userId)
    // Assuming 'admin' uploads always have user_id = NULL or logic handles it.
    // Actually, admins might want to own files too? 
    // Let's say Global files have user_id IS NULL.
    // If admin uploads, we set user_id = NULL (by default or checking role).
    // If regular user uploads, we set user_id = $userId.

    $stmt = $conn->prepare("SELECT * FROM module_files WHERE module_id = ? AND (user_id IS NULL OR user_id = ?) ORDER BY created_at DESC");
    $stmt->bind_param("si", $module_id, $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    $files = [];
    while ($row = $result->fetch_assoc()) {
        // Add a flag to indicate ownership
        $row['is_owner'] = ($row['user_id'] == $userId);
        $files[] = $row;
    }

    json_response($files);

}
elseif ($method === 'POST') {
    // Allow admins OR regular users (for personal copies)
    // if (!$isAdmin) ... we relax this.

    $module_id = $_POST['module_id'] ?? null;
    $title = $_POST['title'] ?? 'Sin título';
    $description = $_POST['description'] ?? '';

    if (!$module_id) {
        json_response(['error' => 'module_id required'], 400);
    }

    $file_id = $_POST['id'] ?? null;

    // Determine user_id to set
    // If Admin, they can choose to make it Global (user_id=NULL) or Personal (not likely for admin in this context).
    // For now: Admin = Global, User = Personal.
    // BUT user wanted "save copy".
    // Getting current user role again
    // $isAdmin is already set at top.

    $target_user_id = $isAdmin ? null : $userId;

    // If updating, verify file exists and ownership
    $existing_file = null;
    if ($file_id) {
        $stmt = $conn->prepare("SELECT * FROM module_files WHERE id = ?");
        $stmt->bind_param("i", $file_id);
        $stmt->execute();
        $res = $stmt->get_result();
        $existing_file = $res->fetch_assoc();

        if (!$existing_file) {
            json_response(['error' => 'Archivo a editar no encontrado'], 404);
        }

        // Ownership check
        // If file is global (user_id IS NULL), only Admin can edit.
        // If file is personal (user_id = X), only User X (or Admin?) can edit.
        if (is_null($existing_file['user_id'])) {
            if (!$isAdmin) {
                // User trying to edit global file -> MUST BE A "SAVE AS NEW" -> handled by Frontend not sending ID?
                // If ID is sent, it means UPDATE.
                json_response(['error' => 'No tiene permisos para editar este archivo global. Guarde una copia.'], 403);
            }
        }
        else {
            if ($existing_file['user_id'] != $userId && !$isAdmin) {
                json_response(['error' => 'No tiene permisos para editar este archivo'], 403);
            }
        }

        // Use existing file's user_id if we are just updating
        $target_user_id = $existing_file['user_id'];
    }

    if (!isset($_FILES['file']) && !$existing_file) {
        json_response(['error' => 'No file uploaded'], 400);
    }

    // Upload logic
    $db_path = null;
    $file_type = null;
    $file_size = 0;
    $preview_db_path = null;

    if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
        $upload_dir = '../uploads/module_files/';
        if (!is_dir($upload_dir)) {
            mkdir($upload_dir, 0755, true);
        }

        $original_name = basename($_FILES['file']['name']);
        $ext = strtolower(pathinfo($original_name, PATHINFO_EXTENSION));

        // Determine file type
        if (in_array($ext, ['xlsx', 'xls', 'csv'])) {
            $file_type = 'excel';
        }
        elseif ($ext === 'pdf') {
            $file_type = 'pdf';
        }
        else {
            $file_type = 'other';
        }

        // Generate unique filename
        $unique_name = uniqid('mf_') . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $original_name);
        $filepath = $upload_dir . $unique_name;

        if (move_uploaded_file($_FILES['file']['tmp_name'], $filepath)) {
            $db_path = '/uploads/module_files/' . $unique_name;
            $file_size = $_FILES['file']['size'];
        }
        else {
            json_response(['error' => 'Error al mover archivo subido'], 500);
        }
    }
    elseif ($existing_file) {
        // Keep existing file info when no new file is uploaded (update metadata only)
        $db_path = $existing_file['file_path'];
        $file_type = $existing_file['file_type'];
        $file_size = $existing_file['file_size'];
        $preview_db_path = $existing_file['preview_image_path'];
    }

    // Handle preview image upload
    if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        $img_dir = '../uploads/preview_images/';
        if (!is_dir($img_dir)) {
            mkdir($img_dir, 0755, true);
        }
        $img_name = uniqid('prev_') . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($_FILES['image']['name']));
        $img_path = $img_dir . $img_name;
        if (move_uploaded_file($_FILES['image']['tmp_name'], $img_path)) {
            $preview_db_path = '/uploads/preview_images/' . $img_name;
        }
    }

    if (!$db_path) {
        json_response(['error' => 'No se pudo procesar el archivo'], 400);
    }

    if ($file_id) {
        // Update existing record
        $stmt = $conn->prepare("UPDATE module_files SET title=?, description=?, file_path=?, file_type=?, file_size=?, preview_image_path=? WHERE id=?");
        $stmt->bind_param("ssssisi", $title, $description, $db_path, $file_type, $file_size, $preview_db_path, $file_id);

        if ($stmt->execute()) {
            json_response([
                'success' => true,
                'file' => [
                    'id' => $file_id,
                    'title' => $title,
                    'file_path' => $db_path,
                    'file_type' => $file_type,
                    'preview_image_path' => $preview_db_path,
                    'user_id' => $target_user_id
                ]
            ]);
        }
        else {
            json_response(['error' => 'Error al actualizar base de datos: ' . $conn->error], 500);
        }
    }
    else {
        // Insert new record
        $stmt = $conn->prepare("INSERT INTO module_files (module_id, user_id, title, description, file_path, file_type, file_size, preview_image_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        // bind_param types: module_id (s), user_id (i), title (s), ...
        // user_id can be NULL.
        $stmt->bind_param("sissssis", $module_id, $target_user_id, $title, $description, $db_path, $file_type, $file_size, $preview_db_path);

        if ($stmt->execute()) {
            json_response([
                'success' => true,
                'file' => [
                    'id' => $stmt->insert_id,
                    'title' => $title,
                    'file_path' => $db_path,
                    'file_type' => $file_type,
                    'preview_image_path' => $preview_db_path,
                    'user_id' => $target_user_id
                ]
            ], 201);
        }
        else {
            // ... cleanup ...
            if (isset($filepath) && file_exists($filepath))
                unlink($filepath);
            if ($preview_db_path && file_exists(".." . $preview_db_path)) {
                unlink(".." . $preview_db_path);
            }
            json_response(['error' => 'Error al guardar en base de datos: ' . $conn->error], 500);
        }
    }

}
elseif ($method === 'DELETE') {

    // Parse input for DELETE request
    $input = json_decode(file_get_contents('php://input'), true);
    $file_id = $input['id'] ?? ($_GET['id'] ?? null);

    if (!$file_id) {
        json_response(['error' => 'ID de archivo requerido'], 400);
    }

    // Obtener registro y verificar ownership
    $stmt = $conn->prepare("SELECT id, user_id, file_path, preview_image_path FROM module_files WHERE id = ?");
    $stmt->bind_param("i", $file_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();

    if (!$row) {
        json_response(['error' => 'Archivo no encontrado'], 404);
    }

    $ownerId = $row['user_id'];
    $canDelete = $isAdmin || ($ownerId !== null && intval($ownerId) === $userId);
    if (!$canDelete) {
        json_response(['error' => 'No tiene permisos para eliminar este archivo'], 403);
    }

    // Borrar archivos físicos si existen
    $physical_path = ".." . $row['file_path'];
    if (file_exists($physical_path)) {
        @unlink($physical_path);
    }
    if (!empty($row['preview_image_path'])) {
        $preview_path = ".." . $row['preview_image_path'];
        if (file_exists($preview_path)) {
            @unlink($preview_path);
        }
    }

    // Borrar registro
    $stmt = $conn->prepare("DELETE FROM module_files WHERE id = ?");
    $stmt->bind_param("i", $file_id);
    if ($stmt->execute()) {
        json_response(['success' => true]);
    }
    else {
        json_response(['error' => 'Error al eliminar de base de datos'], 500);
    }

}
else {
    json_response(['error' => 'Método no permitido'], 405);
}
?>