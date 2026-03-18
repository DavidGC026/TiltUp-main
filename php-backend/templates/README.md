# Plantillas Excel

Coloca aquí el archivo **`bitacora_maestra.xlsx`** que será usado como plantilla base por el endpoint `generar_bitacora.php`.

## Requisitos de la plantilla

- Debe contener la hoja **"Portada"** con el diseño, logos e imágenes ya integrados.
- Debe contener las hojas **"C2"** (Grúas/Maquinaria) y **"C4"** (Manejo de Residuos) con encabezados formateados.
- Las celdas de destino para los datos generales deben coincidir con las definidas en `generar_bitacora.php` (por defecto B4–B10, D8–D9).
- Ajusta las referencias de celda en el PHP si tu plantilla usa una distribución diferente.
