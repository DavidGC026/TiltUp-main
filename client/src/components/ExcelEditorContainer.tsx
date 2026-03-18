import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Workbook } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
// @ts-ignore
import LuckyExcel from "luckyexcel";
import * as xlsx from "xlsx";
import { Button } from "@/components/ui/button";
import { Loader2, X, Save, Copy, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

interface ExcelEditorContainerProps {
    fileUrl: string;
    fileName: string;
    onClose: () => void;
    onSave?: (blob: Blob) => Promise<void>;
    onSaveAs?: (blob: Blob, newTitle: string) => Promise<void>;
    onExportPdf?: (blob: Blob) => Promise<void>;
    isOwner?: boolean;
    isAdmin?: boolean;
}

export function ExcelEditorContainer({ fileUrl, fileName, onClose, onSave, onSaveAs, onExportPdf, isOwner, isAdmin }: ExcelEditorContainerProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
    const [saveAsName, setSaveAsName] = useState("");
    const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const workbookRef = useRef<any>(null);

    useEffect(() => {
        const loadExcel = async () => {
            try {
                setLoading(true);
                const response = await fetch(fileUrl);
                const blob = await response.blob();
                const file = new File([blob], fileName);

                LuckyExcel.transformExcelToLucky(file, (exportJson: any, luckysheetfile: any) => {
                    // Normalize data source
                    let sheetsToLoad = exportJson?.sheets?.length > 0 ? exportJson.sheets : luckysheetfile?.sheets;

                    if (sheetsToLoad?.length > 0) {
                        // Sanitize data to remove unsupported/buggy features
                        const sanitizedSheets = sheetsToLoad.map((sheet: any) => {
                            // Ensure celldata is a proper array of objects
                            const safeCelldata = Array.isArray(sheet.celldata)
                                ? sheet.celldata.filter((c: any) => c && typeof c === 'object')
                                : [];

                            // Ensure data rows are arrays
                            const safeData = Array.isArray(sheet.data)
                                ? sheet.data.map((row: any) => Array.isArray(row) ? row : [])
                                : [];

                            // Sanitize config – ensure merge/borderInfo etc. are arrays/objects
                            const rawConfig = sheet.config || {};
                            const safeConfig: Record<string, any> = {};
                            if (rawConfig.merge && typeof rawConfig.merge === 'object') safeConfig.merge = rawConfig.merge;
                            if (Array.isArray(rawConfig.borderInfo)) safeConfig.borderInfo = rawConfig.borderInfo;
                            if (rawConfig.rowlen && typeof rawConfig.rowlen === 'object') safeConfig.rowlen = rawConfig.rowlen;
                            if (rawConfig.columnlen && typeof rawConfig.columnlen === 'object') safeConfig.columnlen = rawConfig.columnlen;
                            if (rawConfig.rowhidden && typeof rawConfig.rowhidden === 'object') safeConfig.rowhidden = rawConfig.rowhidden;
                            if (rawConfig.colhidden && typeof rawConfig.colhidden === 'object') safeConfig.colhidden = rawConfig.colhidden;

                            return {
                                name: sheet.name || 'Sheet1',
                                index: sheet.index,
                                order: sheet.order,
                                status: sheet.status,
                                row: sheet.row,
                                column: sheet.column,
                                config: safeConfig,
                                celldata: safeCelldata,
                                data: safeData,
                                // Explicitly reset potentially problematic fields
                                images: undefined,
                                dataVerification: undefined,
                                hyperlink: undefined,
                                conditionformat: undefined,
                                frozen: undefined,
                                chart: undefined,
                                calcChain: undefined,
                            };
                        });

                        setData(sanitizedSheets);
                        setLoading(false);
                    } else {
                        console.error("LuckyExcel returned no sheets", exportJson);
                        toast({
                            title: "Error",
                            description: "No se pudo interpretar el archivo Excel.",
                            variant: "destructive"
                        });
                        setLoading(false);
                    }
                }, (err: any) => {
                    console.error("LuckyExcel error:", err);
                    toast({
                        title: "Error",
                        description: "Error al leer el archivo Excel.",
                        variant: "destructive"
                    });
                    setLoading(false);
                });

            } catch (error) {
                console.error("Error fetching excel file:", error);
                toast({
                    title: "Error",
                    description: "No se pudo descargar el archivo.",
                    variant: "destructive",
                });
                setLoading(false);
            }
        };

        loadExcel();
    }, [fileUrl, toast, fileName]);

    const handleSave = async () => {
        if (!workbookRef.current || !onSave) return;

        try {
            setIsSaving(true);
            const sheets = workbookRef.current.getAllSheets();

            const wb = xlsx.utils.book_new();

            sheets.forEach((sheet: any) => {
                const sheetData = sheet.data;
                if (!sheetData) return;

                const aoa: any[][] = [];
                for (let r = 0; r < sheetData.length; r++) {
                    const row: any[] = [];
                    const rowData = sheetData[r];
                    if (rowData) {
                        for (let c = 0; c < rowData.length; c++) {
                            const cell = rowData[c];
                            let val = null;
                            if (cell) {
                                val = cell.v !== undefined ? cell.v : null;
                            }
                            row.push(val);
                        }
                    }
                    aoa.push(row);
                }

                const ws = xlsx.utils.aoa_to_sheet(aoa);
                xlsx.utils.book_append_sheet(wb, ws, sheet.name);
            });

            const wbout = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

            await onSave(blob);
            setIsSaving(false);
        } catch (error: any) {
            console.error("Error saving:", error);
            toast({
                title: "Error al guardar",
                description: error.message || "Ocurrió un error al procesar el archivo.",
                variant: "destructive"
            });
            setIsSaving(false);
        }
    };

    const handleExportPdf = async () => {
        if (!workbookRef.current || !onExportPdf) return;
        try {
            setIsExporting(true);
            const sheets = workbookRef.current.getAllSheets();
            const wb = xlsx.utils.book_new();

            sheets.forEach((sheet: any) => {
                const sheetData = sheet.data;
                if (!sheetData) return;
                const aoa: any[][] = [];
                for (let r = 0; r < sheetData.length; r++) {
                    const row: any[] = [];
                    const rowData = sheetData[r];
                    if (rowData) {
                        for (let c = 0; c < rowData.length; c++) {
                            const cell = rowData[c];
                            let val = null;
                            if (cell) {
                                val = cell.v !== undefined ? cell.v : null;
                            }
                            row.push(val);
                        }
                    }
                    aoa.push(row);
                }
                const ws = xlsx.utils.aoa_to_sheet(aoa);
                xlsx.utils.book_append_sheet(wb, ws, sheet.name);
            });

            const wbout = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            await onExportPdf(blob);
        } catch (error: any) {
            console.error("Error exportando a PDF:", error);
            toast({
                title: "Error",
                description: error.message || "No se pudo exportar a PDF.",
                variant: "destructive"
            });
        } finally {
            setIsExporting(false);
        }
    };

    const buildBlob = (): Blob | null => {
        if (!workbookRef.current) return null;
        const sheets = workbookRef.current.getAllSheets();
        const wb = xlsx.utils.book_new();

        sheets.forEach((sheet: any) => {
            const sheetData = sheet.data;
            if (!sheetData) return;
            const aoa: any[][] = [];
            for (let r = 0; r < sheetData.length; r++) {
                const row: any[] = [];
                const rowData = sheetData[r];
                if (rowData) {
                    for (let c = 0; c < rowData.length; c++) {
                        const cell = rowData[c];
                        let val = null;
                        if (cell) {
                            val = cell.v !== undefined ? cell.v : null;
                        }
                        row.push(val);
                    }
                }
                aoa.push(row);
            }
            const ws = xlsx.utils.aoa_to_sheet(aoa);
            xlsx.utils.book_append_sheet(wb, ws, sheet.name);
        });

        const wbout = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
        return new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    };

    const handleSaveAs = () => {
        console.log("handleSaveAs called, workbookRef:", workbookRef.current);
        const blob = buildBlob();
        console.log("buildBlob result:", blob);
        if (!blob) {
            // If workbook ref doesn't work, just open dialog anyway and build blob on confirm
            setSaveAsName(fileName.replace(/\.[^/.]+$/, '') + ' (Copia)');
            setShowSaveAsDialog(true);
            return;
        }
        setPendingBlob(blob);
        setSaveAsName(fileName.replace(/\.[^/.]+$/, '') + ' (Copia)');
        setShowSaveAsDialog(true);
    };

    const confirmSaveAs = async () => {
        if (!onSaveAs || !saveAsName.trim()) return;
        try {
            setIsSaving(true);
            setShowSaveAsDialog(false);
            // Build blob now if not already built
            const blob = pendingBlob || buildBlob();
            if (!blob) {
                toast({
                    title: "Error",
                    description: "No se pudo generar el archivo. Intente de nuevo.",
                    variant: "destructive"
                });
                setIsSaving(false);
                return;
            }
            await onSaveAs(blob, saveAsName.trim());
            setPendingBlob(null);
            setIsSaving(false);
        } catch (error: any) {
            console.error("Error saving as:", error);
            toast({
                title: "Error al guardar",
                description: error.message || "Ocurrió un error al guardar la copia.",
                variant: "destructive"
            });
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-white">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Cargando editor...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-screen bg-background fixed inset-0 z-[9999]">
            <div className="flex items-center justify-between p-2 border-b bg-white shadow-sm z-50">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg ml-2">{fileName}</h3>
                    {!(isOwner || isAdmin) && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">Modo Copia</span>}
                </div>
                <div className="flex items-center gap-2">
                    {(isOwner || isAdmin) && onSave && (
                        <Button onClick={handleSave} disabled={isSaving} size="sm" className="gap-2">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Guardar
                        </Button>
                    )}
                    {onExportPdf && (
                        <Button onClick={handleExportPdf} disabled={isExporting} size="sm" variant="secondary" className="gap-2">
                            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                            Exportar PDF
                        </Button>
                    )}
                    {onSaveAs && (
                        <Button onClick={handleSaveAs} disabled={isSaving} size="sm" variant="outline" className="gap-2">
                            <Copy className="h-4 w-4" />
                            Guardar como
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <X className="h-4 w-4" />
                        Cerrar
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {data.length > 0 && (
                    <Workbook
                        ref={workbookRef}
                        data={data}
                        lang="es"
                        showToolbar={true}
                        onChange={() => { }}
                    />
                )}
            </div>

            {showSaveAsDialog && createPortal(
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50">
                    <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
                        <h2 className="text-lg font-semibold mb-1">Guardar como</h2>
                        <p className="text-sm text-muted-foreground mb-4">
                            Ingrese el nombre para la nueva copia del archivo.
                        </p>
                        <Input
                            value={saveAsName}
                            onChange={(e) => setSaveAsName(e.target.value)}
                            placeholder="Nombre del archivo"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') confirmSaveAs(); }}
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" onClick={() => setShowSaveAsDialog(false)}>Cancelar</Button>
                            <Button onClick={confirmSaveAs} disabled={!saveAsName.trim()}>Guardar</Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
