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
// require_once __DIR__ . '/../config/db.php';  // Descomenta si necesitas sesión

use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

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
// Usa la plantilla subida. Ajusta la ruta si cambia.

$templatePath = __DIR__ . '/../templates/bitacora_maestra.xlsx';

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

// ═══════════════════════════════════════════════════════════════════════════════
// ███  HOJA "Portada"
// ═══════════════════════════════════════════════════════════════════════════════
//
// Estructura detectada en la plantilla:
//   G1  = "Logo" (imagen — no tocar)
//   A2  = "BITÁCORA DE CAMPO TILT UP" (título — no tocar)
//   A3  = "Empresa Contratista Principal:"  → valor en B3 (o celda contigua)
//   A4  = "Proyecto: "  / F4 = "Folio: "   → valor en B4 / G4
//   A5  = "Ubicación:"                      → valor en B5
//   A7  = "Fecha de inicio programada :" / F7 = "Real:" → B7 / G7
//   A8  = "Fecha de termino programada :" / F8 = "Real:" → B8 / G8
//   A11 = "Responsables en obra:"
//   A12 = "Nombre" / C12 = "Afiliación" / D12 = "Cargo" / F12 = "Firma"
//   Filas 13+ = datos de responsables

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
// ███  HOJA "C2" — Plan de Manejo de Residuos
// ═══════════════════════════════════════════════════════════════════════════════
//
// Estructura:
//   L1 = Logo
//   A2 = "Proyecto:" → B2 valor
//   A3 = "Fecha:"    → B3 valor
//   A4 = "Plan de manejo de residuos" (título)
//   Fila 5 = Encabezados: A=Etapa, B=Tipo Residuo, C=Clasificación, D=Volumen,
//            E=Área Acopio, F=Contenedor, G=Frecuencia, H=Empresa Transp.,
//            I=Sitio Disposición, J=Fecha Retiro, K=No. Manifiesto, L=Observaciones
//   Filas 6–19 = 14 etapas constructivas pre-llenadas en columna A
//   Columnas B–L = datos a rellenar

$hojaC2 = $spreadsheet->getSheetByName('C2');
if ($hojaC2) {
    $hojaC2->setCellValue('B2', $data['proyecto'] ?? '');
    $hojaC2->setCellValue('B3', $data['fecha_general'] ?? '');

    $residuos = $data['residuos'] ?? [];
    // Las etapas están en filas 6-19 (14 etapas). Inyectamos cols B–L.
    $c2StartRow = 6;
    foreach ($residuos as $i => $res) {
        $row = $c2StartRow + $i;
        if ($row > 19)
            break; // No exceder las filas de la plantilla

        // No sobrescribir columna A (etapa pre-llenada)
        $hojaC2->setCellValue("B{$row}", $res['tipo_residuo'] ?? '');
        $hojaC2->setCellValue("C{$row}", $res['clasificacion'] ?? '');
        $hojaC2->setCellValue("D{$row}", $res['volumen_estimado'] ?? '');
        $hojaC2->setCellValue("E{$row}", $res['area_acopio'] ?? '');
        $hojaC2->setCellValue("F{$row}", $res['contenedor_metodo'] ?? '');
        $hojaC2->setCellValue("G{$row}", $res['frecuencia_retiro'] ?? '');
        $hojaC2->setCellValue("H{$row}", $res['empresa_transportista'] ?? '');
        $hojaC2->setCellValue("I{$row}", $res['sitio_disposicion'] ?? '');
        $hojaC2->setCellValue("J{$row}", $res['fecha_retiro'] ?? '');
        $hojaC2->setCellValue("K{$row}", $res['no_manifiesto'] ?? '');
        $hojaC2->setCellValue("L{$row}", $res['observaciones'] ?? '');
    }
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
// ███  GENERAR Y DEVOLVER EL ARCHIVO
// ═══════════════════════════════════════════════════════════════════════════════

$folio = preg_replace('/[^a-zA-Z0-9_-]/', '_', $data['folio']);
$filename = "bitacora_{$folio}_" . date('Ymd_His') . '.xlsx';
$tempFile = tempnam(sys_get_temp_dir(), 'bitacora_') . '.xlsx';

try {
    $writer = new Xlsx($spreadsheet);
    $writer->save($tempFile);
}
catch (\Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Error al generar archivo: ' . $e->getMessage()]);
    exit;
}

// Enviar al cliente
header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . filesize($tempFile));
header('Cache-Control: max-age=0');

readfile($tempFile);

// Limpieza
unlink($tempFile);
$spreadsheet->disconnectWorksheets();
unset($spreadsheet);
exit;