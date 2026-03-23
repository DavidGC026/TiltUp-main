<?php
/**
 * generar_bitacora.php
 *
 * Recibe JSON con datos de la bitácora de campo, los inyecta en la plantilla
 * maestra (.xlsx) usando PhpSpreadsheet y devuelve el archivo para descarga.
 *
 * Requisito:  composer require phpoffice/phpspreadsheet
 *
 * ─── Estructura real de la plantilla ──────────────────────────────────────────
 *   Hoja "Portada"  → Datos generales + responsables (filas 1-23, cols A-G)
 *   Hoja "C2"       → Plan de manejo de residuos   (filas 1-25, cols A-L)
 *   Hoja "C3"       → Inspección de moldaje         (filas 1-24, cols A-H)
 *   Hoja "C4"       → Carga de grúa                 (filas 1-23, cols A-G/F)
 *   Hoja "C5"       → Instalación de insertos        (filas 1-33, cols A-P)
 */

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/db.php';

// Asegurar sesión para obtener user_id
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
// require_once __DIR__ . '/../config/db.php';  // Descomenta si necesitas sesión

use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Writer\Pdf\Mpdf;

// ─── CORS ────────────────────────────────────────────────────────────────────

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

// ─── Leer JSON ───────────────────────────────────────────────────────────────

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || empty($data['proyecto']) || empty($data['folio'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Se requiere al menos "proyecto" y "folio".']);
    exit;
}

// ─── Plantilla maestra ──────────────────────────────────────────────────────
// Nuevo formato con ~27–30 hojas ubicado en /shared
$templatePath = __DIR__ . '/../../shared/Bitacora de campo tilt up_13022026.xlsx';

// Fallback: buscar la más reciente en uploads/formatos
if (!file_exists($templatePath)) {
    $fallback = glob(__DIR__ . '/../../uploads/formatos/*Bitacora*.xlsx');
    if ($fallback) {
        usort($fallback, function ($a, $b) {
            return filemtime($b) - filemtime($a);
        });
        $templatePath = $fallback[0];
    }
}

// ─── Mapeo por hoja (fila inicio + columnas) ───────────────────────────────
$mappingPath = __DIR__ . '/../../shared/mapeo_bitacora.json';
$sheetMappings = [];
if (file_exists($mappingPath)) {
    $json = file_get_contents($mappingPath);
    $sheetMappings = json_decode($json, true) ?: [];
}

if (!file_exists($templatePath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Plantilla maestra no encontrada.']);
    exit;
}

try {
    $spreadsheet = IOFactory::load($templatePath);
}
catch (\Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Error al cargar plantilla: ' . $e->getMessage()]);
    exit;
}

// Helper: escribir Proyecto / Fecha (general) en B2/B3 si existen
$writeProyectoFecha = function ($sheet) use ($data) {
    if (!$sheet)
        return;
    try {
        $sheet->setCellValue('B2', $data['proyecto'] ?? '');
        $sheet->setCellValue('B3', $data['fecha_general'] ?? '');
    }
    catch (\Throwable $t) {
    // ignorar si la hoja no tiene esas celdas
    }
};

// Helper: llenar según mapeo JSON y un orden de propiedades
function fillSheetByMapping($sheet, $mapping, $rowsData, $propertyOrder)
{
    if (!$sheet || !$mapping || !$rowsData || !$propertyOrder)
        return;
    $startRow = intval($mapping['fila_inicio_datos'] ?? 0);
    if ($startRow <= 0)
        return;
    $columnsMap = $mapping['columnas'] ?? [];
    if (!$columnsMap)
        return;
    $colLetters = array_keys($columnsMap);

    try {
        $rowIdx = $startRow;
        foreach ($rowsData as $row) {
            foreach ($colLetters as $idx => $colLetter) {
                if (!isset($propertyOrder[$idx]))
                    continue;
                $prop = $propertyOrder[$idx];
                $val = $row[$prop] ?? '';
                $sheet->setCellValue($colLetter . $rowIdx, $val);
            }
            $rowIdx++;
        }
    }
    catch (\Throwable $t) {
    // silent per sheet
    }
}

// Aplicar Proyecto/Fecha en todas las hojas (27–30)
foreach ($spreadsheet->getAllSheets() as $sh) {
    $writeProyectoFecha($sh);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ███  HOJA "Portada"
// ═══════════════════════════════════════════════════════════════════════════════
//
// Estructura: se mantiene respecto al formato previo.

$portada = $spreadsheet->getSheetByName('Portada') ?? $spreadsheet->getActiveSheet();

// Datos generales – inyectar en las celdas contiguas a las etiquetas
$portada->setCellValue('B3', $data['empresa_contratista'] ?? '');
$portada->setCellValue('B4', $data['proyecto'] ?? '');
$portada->setCellValue('G4', $data['folio'] ?? '');
$portada->setCellValue('B5', $data['ubicacion'] ?? '');
$portada->setCellValue('B7', $data['fecha_inicio_programada'] ?? '');
$portada->setCellValue('G7', $data['fecha_inicio_real'] ?? '');
$portada->setCellValue('B8', $data['fecha_termino_programada'] ?? '');
$portada->setCellValue('G8', $data['fecha_termino_real'] ?? '');

// Responsables (fila 13 en adelante, cols A/C/D)
$responsables = $data['responsables'] ?? [];
$respStartRow = 13;
foreach ($responsables as $i => $resp) {
    $row = $respStartRow + $i;
    $portada->setCellValue("A{$row}", $resp['nombre'] ?? '');
    $portada->setCellValue("C{$row}", $resp['afiliacion'] ?? '');
    $portada->setCellValue("D{$row}", $resp['cargo'] ?? '');
// F = Firma (se deja vacío para firma manuscrita)
}


// ═══════════════════════════════════════════════════════════════════════════════
// ███  HOJAS "C2" … "C27" — Llenado usando mapeo JSON
// ═══════════════════════════════════════════════════════════════════════════════

$sheetNames = $spreadsheet->getSheetNames();

// C2: plan de residuos (mapping no detectado; se mantiene el llenado previo clásico)
$hojaC2 = $spreadsheet->getSheetByName('C2');
if ($hojaC2) {
    $rows = $data['residuos'] ?? [];
    $startRow = 6;
    foreach ($rows as $i => $r) {
        $row = $startRow + $i;
        if ($row > 19)
            break;
        $hojaC2->setCellValue("B{$row}", $r['tipo_residuo'] ?? '');
        $hojaC2->setCellValue("C{$row}", $r['clasificacion'] ?? '');
        $hojaC2->setCellValue("D{$row}", $r['volumen_estimado'] ?? '');
        $hojaC2->setCellValue("E{$row}", $r['area_acopio'] ?? '');
        $hojaC2->setCellValue("F{$row}", $r['contenedor_metodo'] ?? '');
        $hojaC2->setCellValue("G{$row}", $r['frecuencia_retiro'] ?? '');
        $hojaC2->setCellValue("H{$row}", $r['empresa_transportista'] ?? '');
        $hojaC2->setCellValue("I{$row}", $r['sitio_disposicion'] ?? '');
        $hojaC2->setCellValue("J{$row}", $r['fecha_retiro'] ?? '');
        $hojaC2->setCellValue("K{$row}", $r['no_manifiesto'] ?? '');
        $hojaC2->setCellValue("L{$row}", $r['observaciones'] ?? '');
    }
}

// C3
if (isset($sheetMappings['C3'])) {
    $mapping = $sheetMappings['C3'];
    $rows = $data['moldaje'] ?? [];
    $propertyOrder = ['criterio', 'descripcion', 'cumple', 'nivel_dano', 'accion_requerida', 'responsable', 'fecha_compromiso', 'observaciones'];
    $hoja = $spreadsheet->getSheetByName('C3');
    fillSheetByMapping($hoja, $mapping, $rows, $propertyOrder);
    // Dictamen / justificación
    if ($hoja) {
        $dictamen = $data['dictamen_moldaje'] ?? '';
        $dictamenTexto = '';
        switch ($dictamen) {
            case 'apto':
                $dictamenTexto = '☑ Apto para uso inmediato           ☐ Uso condicionado (requiere reparación)             ☐ Retiro definitivo';
                break;
            case 'condicionado':
                $dictamenTexto = '☐ Apto para uso inmediato           ☑ Uso condicionado (requiere reparación)             ☐ Retiro definitivo';
                break;
            case 'retiro':
                $dictamenTexto = '☐ Apto para uso inmediato           ☐ Uso condicionado (requiere reparación)             ☑ Retiro definitivo';
                break;
            default:
                $dictamenTexto = '☐ Apto para uso inmediato           ☐ Uso condicionado (requiere reparación)             ☐ Retiro definitivo';
                break;
        }
        try {
            $hoja->setCellValue('A19', '   ' . $dictamenTexto);
            $hoja->setCellValue('A22', $data['justificacion_moldaje'] ?? '');
        }
        catch (\Throwable $t) {
        }
    }
}

// C4
if (isset($sheetMappings['C4'])) {
    $mapping = $sheetMappings['C4'];
    $rows = $data['grua'] ?? [];
    $propertyOrder = ['criterio', 'verificacion', 'cumple', 'dato_confirmado', 'accion_requerida', 'observaciones'];
    $hoja = $spreadsheet->getSheetByName('C4');
    fillSheetByMapping($hoja, $mapping, $rows, $propertyOrder);
}

// C5
if (isset($sheetMappings['C5'])) {
    $mapping = $sheetMappings['C5'];
    $rows = $data['insertos'] ?? [];
    $propertyOrder = ['panel_no', 'peso_panel', 'resistencia_requerida', 'resistencia_verificada', 'grua', 'operador', 'inserto_limpio', 'deformaciones', 'fisuras', 'capacidad_inserto', 'capacidad_conexion', 'seguro_activado', 'perno_insertado', 'rosca_completa', 'alineacion_correcta', 'angulo_correcto'];
    $hoja = $spreadsheet->getSheetByName('C5');
    fillSheetByMapping($hoja, $mapping, $rows, $propertyOrder);
}

// C6..C27: si existe mapeo y tenemos datos en $data['insertos'] (como fuente genérica), llenar por posición respetando columnas definidas
for ($i = 6; $i <= 27; $i++) {
    $name = 'C' . $i;
    if (!isset($sheetMappings[$name]))
        continue;
    $mapping = $sheetMappings[$name];
    $hoja = $spreadsheet->getSheetByName($name);
    if (!$hoja)
        continue;

    // Fuente genérica: insertos (por ahora), se mapea por posición de columnas
    $rows = $data['insertos'] ?? [];
    if (!$rows)
        continue;

    // Construir propertyOrder con tantos elementos como columnas, usando índices numéricos de las filas de insertos
    $columns = array_keys($mapping['columnas'] ?? []);
    $propertyOrder = [];
    foreach ($columns as $idx => $colLetter) {
        // si el insert tiene clave numérica, usamos la posición
        $propertyOrder[$idx] = $idx; // index-based; we will pull by numeric index
    }

    // Adapt rows to numeric-index array
    $normalizedRows = [];
    foreach ($rows as $row) {
        // ensure numeric ordering of values
        $values = array_values($row);
        $normalizedRows[] = $values;
    }

    fillSheetByMapping($hoja, $mapping, $normalizedRows, $propertyOrder);
}


// ═══════════════════════════════════════════════════════════════════════════════
// ███  HOJA "C3" — Inspección Previa del Material de Moldaje
// ═══════════════════════════════════════════════════════════════════════════════
//
// Estructura:
//   H1 = Logo
//   A2 = "Proyecto:" → B2
//   A3 = "Fecha:"    → B3
//   Fila 5 = Encabezados: A=Criterio, B=Descripción, C=Cumple, D=Nivel daño,
//            E=Acción requerida, F=Responsable, G=Fecha compromiso, H=Observaciones
//   Filas 6–16 = 11 criterios pre-llenados en cols A y B
//   A19 = Dictamen (checkboxes en texto)
//   A21 = "Justificación técnica del dictamen:" → A22 o celda siguiente

$hojaC3 = $spreadsheet->getSheetByName('C3');
if ($hojaC3) {
    $hojaC3->setCellValue('B2', $data['proyecto'] ?? '');
    $hojaC3->setCellValue('B3', $data['fecha_general'] ?? '');

    $moldaje = $data['moldaje'] ?? [];
    $c3StartRow = 6;
    foreach ($moldaje as $i => $m) {
        $row = $c3StartRow + $i;
        if ($row > 16)
            break;

        // No sobrescribir A y B (criterio y descripción pre-llenados)
        $hojaC3->setCellValue("C{$row}", $m['cumple'] ?? '');
        $hojaC3->setCellValue("D{$row}", $m['nivel_dano'] ?? '');
        $hojaC3->setCellValue("E{$row}", $m['accion_requerida'] ?? '');
        $hojaC3->setCellValue("F{$row}", $m['responsable'] ?? '');
        $hojaC3->setCellValue("G{$row}", $m['fecha_compromiso'] ?? '');
        $hojaC3->setCellValue("H{$row}", $m['observaciones'] ?? '');
    }

    // Dictamen
    $dictamen = $data['dictamen_moldaje'] ?? '';
    $dictamenTexto = '';
    switch ($dictamen) {
        case 'apto':
            $dictamenTexto = '☑ Apto para uso inmediato           ☐ Uso condicionado (requiere reparación)             ☐ Retiro definitivo';
            break;
        case 'condicionado':
            $dictamenTexto = '☐ Apto para uso inmediato           ☑ Uso condicionado (requiere reparación)             ☐ Retiro definitivo';
            break;
        case 'retiro':
            $dictamenTexto = '☐ Apto para uso inmediato           ☐ Uso condicionado (requiere reparación)             ☑ Retiro definitivo';
            break;
        default:
            $dictamenTexto = '☐ Apto para uso inmediato           ☐ Uso condicionado (requiere reparación)             ☐ Retiro definitivo';
            break;
    }
    $hojaC3->setCellValue('A19', '   ' . $dictamenTexto);

    // Justificación – fila 22 (debajo de la etiqueta en fila 21)
    $hojaC3->setCellValue('A22', $data['justificacion_moldaje'] ?? '');
}


// ═══════════════════════════════════════════════════════════════════════════════
// ███  HOJA "C4" — Carga de Grúa
// ═══════════════════════════════════════════════════════════════════════════════
//
// Estructura:
//   F1 = Logo
//   A2 = "Proyecto:" → B2
//   A3 = "Fecha:"    → B3
//   Fila 5 = Encabezados: A=Criterio, B=Verificación, C=Cumple, D=Dato confirmado,
//            E=Acción requerida, F=Observaciones
//   Filas 6–17 = 12 criterios pre-llenados en cols A y B
//   A19 = "Responsables:" / F19 = "Firma:"

$hojaC4 = $spreadsheet->getSheetByName('C4');
if ($hojaC4) {
    $hojaC4->setCellValue('B2', $data['proyecto'] ?? '');
    $hojaC4->setCellValue('B3', $data['fecha_general'] ?? '');

    $gruaData = $data['grua'] ?? [];
    $c4StartRow = 6;
    foreach ($gruaData as $i => $g) {
        $row = $c4StartRow + $i;
        if ($row > 17)
            break;

        // No sobrescribir A y B (criterio y verificación pre-llenados)
        $hojaC4->setCellValue("C{$row}", $g['cumple'] ?? '');
        $hojaC4->setCellValue("D{$row}", $g['dato_confirmado'] ?? '');
        $hojaC4->setCellValue("E{$row}", $g['accion_requerida'] ?? '');
        $hojaC4->setCellValue("F{$row}", $g['observaciones'] ?? '');
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ███  HOJA "C5" — Instalación de Insertos
// ═══════════════════════════════════════════════════════════════════════════════
//
// Estructura:
//   K1 = Logo
//   A2 = "Proyecto:" → B2
//   A3 = "Fecha:"    → B3
//   Fila 5 = Encabezados (16 columnas A–P):
//     A=Panel No., B=Peso, C=Resist. Req., D=Resist. Verif., E=Grúa,
//     F=Operador, G=Inserto limpio, H=Deformaciones, I=Fisuras,
//     J=Cap. Inserto, K=Cap. Conexión, L=Seguro, M=Perno, N=Rosca,
//     O=Alineación, P=Ángulo
//   Filas 6–28 = datos (hasta 23 paneles)
//   A29 = "Responsables:" / K29 = "Firma:"

$hojaC5 = $spreadsheet->getSheetByName('C5');
if ($hojaC5) {
    $hojaC5->setCellValue('B2', $data['proyecto'] ?? '');
    $hojaC5->setCellValue('B3', $data['fecha_general'] ?? '');

    $insertos = $data['insertos'] ?? [];
    $c5StartRow = 6;
    foreach ($insertos as $i => $ins) {
        $row = $c5StartRow + $i;
        if ($row > 28)
            break; // No exceder las filas antes de "Responsables"

        $hojaC5->setCellValue("A{$row}", $ins['panel_no'] ?? '');
        $hojaC5->setCellValue("B{$row}", $ins['peso_panel'] ?? '');
        $hojaC5->setCellValue("C{$row}", $ins['resistencia_requerida'] ?? '');
        $hojaC5->setCellValue("D{$row}", $ins['resistencia_verificada'] ?? '');
        $hojaC5->setCellValue("E{$row}", $ins['grua'] ?? '');
        $hojaC5->setCellValue("F{$row}", $ins['operador'] ?? '');
        $hojaC5->setCellValue("G{$row}", $ins['inserto_limpio'] ?? '');
        $hojaC5->setCellValue("H{$row}", $ins['deformaciones'] ?? '');
        $hojaC5->setCellValue("I{$row}", $ins['fisuras'] ?? '');
        $hojaC5->setCellValue("J{$row}", $ins['capacidad_inserto'] ?? '');
        $hojaC5->setCellValue("K{$row}", $ins['capacidad_conexion'] ?? '');
        $hojaC5->setCellValue("L{$row}", $ins['seguro_activado'] ?? '');
        $hojaC5->setCellValue("M{$row}", $ins['perno_insertado'] ?? '');
        $hojaC5->setCellValue("N{$row}", $ins['rosca_completa'] ?? '');
        $hojaC5->setCellValue("O{$row}", $ins['alineacion_correcta'] ?? '');
        $hojaC5->setCellValue("P{$row}", $ins['angulo_correcto'] ?? '');
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ███  GENERAR Y GUARDAR XLSX + PDF EN SERVIDOR (sin descarga directa)
// ═══════════════════════════════════════════════════════════════════════════════

$folioSafe = preg_replace('/[^a-zA-Z0-9_-]/', '_', $data['folio'] ?? 'SD');
$timestamp = date('Ymd_His');

// Directorio de salida: /uploads/bitacoras (dentro de TiltUp)
$baseUploads = realpath(__DIR__ . '/../uploads');
if ($baseUploads === false) {
    $baseUploads = __DIR__ . '/../uploads';
}
$bitacoraDir = $baseUploads . '/bitacoras';
if (!is_dir($bitacoraDir)) {
    mkdir($bitacoraDir, 0775, true);
}
@chmod($bitacoraDir, 0775);

$xlsxPath = "$bitacoraDir/bitacora_{$folioSafe}_{$timestamp}.xlsx";
$pdfPath = "$bitacoraDir/bitacora_{$folioSafe}_{$timestamp}.pdf";

try {
    // Guardar XLSX
    $writerXlsx = new Xlsx($spreadsheet);
    $writerXlsx->save($xlsxPath);

    // Guardar PDF con mPDF
    $writerPdf = new Mpdf($spreadsheet);
    $writerPdf->writeAllSheets();
    $writerPdf->save($pdfPath);
}
catch (\Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Error al generar archivos: ' . $e->getMessage()]);
    exit;
}

// URLs relativas para ser consumidas por el frontend (mismo dominio)
$xlsxUrl = '/uploads/bitacoras/' . basename($xlsxPath);
$pdfUrl = '/uploads/bitacoras/' . basename($pdfPath);

// Registrar ambos en module_files para que aparezcan en el Módulo 4
$moduleId = 'modulo-4';
$userId = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : null; // asociar al usuario autenticado
$desc = 'Bitácora generada desde el formulario';

// XLSX
$titleXlsx = 'Bitácora XLSX ' . $folioSafe;
$fileSizeX = file_exists($xlsxPath) ? filesize($xlsxPath) : 0;
$fileTypeX = 'excel';
$preview1 = null;
$stmt = $conn->prepare("INSERT INTO module_files (module_id, user_id, title, description, file_path, file_type, file_size, preview_image_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
$stmt->bind_param('sissssis', $moduleId, $userId, $titleXlsx, $desc, $xlsxUrl, $fileTypeX, $fileSizeX, $preview1);
$stmt->execute();

// PDF
$titlePdf = 'Bitácora PDF ' . $folioSafe;
$fileSizeP = file_exists($pdfPath) ? filesize($pdfPath) : 0;
$fileTypeP = 'pdf';
$preview2 = null;
$stmt = $conn->prepare("INSERT INTO module_files (module_id, user_id, title, description, file_path, file_type, file_size, preview_image_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
$stmt->bind_param('sissssis', $moduleId, $userId, $titlePdf, $desc, $pdfUrl, $fileTypeP, $fileSizeP, $preview2);
$stmt->execute();

header('Content-Type: application/json');
echo json_encode([
    'xlsx_url' => $xlsxUrl,
    'pdf_url' => $pdfUrl,
]);

$spreadsheet->disconnectWorksheets();
unset($spreadsheet);
exit;