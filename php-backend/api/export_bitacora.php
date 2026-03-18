<?php
// Sube un XLSX desde LuckySheet, genera PDF con PhpSpreadsheet+mpdf, guarda ambos en /uploads/bitacoras,
// registra en module_files (module_id por defecto 'modulo-4') y devuelve las URLs.

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/db.php';

use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Writer\Pdf\Mpdf;

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
    exit;
}

$userId = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : null;
$moduleId = $_POST['module_id'] ?? 'modulo-4';
$titleBase = $_POST['title'] ?? 'Bitácora';
$desc = $_POST['description'] ?? 'Bitácora generada desde LuckySheet';

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'Archivo XLSX requerido']);
    exit;
}

// Rutas de salida (dentro de php-backend/uploads)
$baseUploads = realpath(__DIR__ . '/../uploads');
if ($baseUploads === false) {
    $baseUploads = __DIR__ . '/../uploads';
}
$bitacoraDir = $baseUploads . '/bitacoras';
if (!is_dir($bitacoraDir)) {
    mkdir($bitacoraDir, 0775, true);
}

// Guardar XLSX subido
$ext = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));
if (!in_array($ext, ['xlsx', 'xls'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Solo se permite XLSX/XLS']);
    exit;
}

$safeTitle = preg_replace('/[^a-zA-Z0-9_-]/', '_', $titleBase);
$timestamp = date('Ymd_His');
$xlsxFilename = "bitacora_{$safeTitle}_{$timestamp}.xlsx";
$pdfFilename = "bitacora_{$safeTitle}_{$timestamp}.pdf";
$xlsxPath = "$bitacoraDir/$xlsxFilename";
$pdfPath = "$bitacoraDir/$pdfFilename";

if (!move_uploaded_file($_FILES['file']['tmp_name'], $xlsxPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'No se pudo guardar el XLSX subido']);
    exit;
}

// Generar PDF con PhpSpreadsheet + mPDF
try {
    $spreadsheet = IOFactory::load($xlsxPath);
    $writerPdf = new Mpdf($spreadsheet);
    $writerPdf->writeAllSheets();
    $writerPdf->save($pdfPath);
}
catch (\Exception $e) {
    @unlink($xlsxPath);
    http_response_code(500);
    echo json_encode(['error' => 'Error al generar PDF: ' . $e->getMessage()]);
    exit;
}

// Insertar en module_files (xlsx y pdf)
$insertSql = "INSERT INTO module_files (module_id, user_id, title, description, file_path, file_type, file_size, preview_image_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
$stmt = $conn->prepare($insertSql);

$previewNull = null;

// XLSX
$filePathX = '/uploads/bitacoras/' . $xlsxFilename;
$fileSizeX = file_exists($xlsxPath) ? filesize($xlsxPath) : 0;
$fileTypeX = 'excel';
$titleX = $titleBase . ' (XLSX)';
$stmt->bind_param('sissssis', $moduleId, $userId, $titleX, $desc, $filePathX, $fileTypeX, $fileSizeX, $previewNull);
$stmt->execute();

// PDF
$filePathP = '/uploads/bitacoras/' . $pdfFilename;
$fileSizeP = file_exists($pdfPath) ? filesize($pdfPath) : 0;
$fileTypeP = 'pdf';
$titleP = $titleBase . ' (PDF)';
$stmt->bind_param('sissssis', $moduleId, $userId, $titleP, $desc, $filePathP, $fileTypeP, $fileSizeP, $previewNull);
$stmt->execute();

echo json_encode([
    'xlsx_url' => $filePathX,
    'pdf_url' => $filePathP,
]);

if (isset($spreadsheet)) {
    $spreadsheet->disconnectWorksheets();
    unset($spreadsheet);
}
exit;