import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, FileSpreadsheet, Upload, Trash2, Download, Edit, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useRef } from "react";
import { createPortal } from "react-dom";

import { ExcelEditorContainer } from "./ExcelEditorContainer";
import { BitacoraForm } from "./BitacoraForm";
import { PDFViewer } from "./PDFViewer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";

interface ModuleFile {
    id: number;
    title: string;
    description: string;
    file_path: string;
    file_type: 'pdf' | 'excel';
    file_size: number;
    preview_image_path?: string;
    created_at: string;
    is_owner: boolean; // Added from API
}

interface ModuleFileDownloaderProps {
    moduleId: string;
}

export function ModuleFileDownloader({ moduleId }: ModuleFileDownloaderProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [editingFile, setEditingFile] = useState<ModuleFile | null>(null);
    const [showBitacoraForm, setShowBitacoraForm] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const { data: files, isLoading } = useQuery<ModuleFile[]>({
        queryKey: ["/api/module_files", moduleId],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/module_files.php?module_id=${moduleId}`);
            return res.json();
        }
    });

    const uploadMutation = useMutation({
        mutationFn: async (formData: FormData) => {
            const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
            const url = `${basePath}/api/module_files.php`;

            const res = await fetch(url, {
                method: "POST",
                body: formData,
                credentials: "include",
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Error al subir archivo");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/module_files", moduleId] });
            toast({
                title: "Archivo guardado",
                description: "El archivo se ha guardado correctamente.",
            });
            setIsUploadOpen(false);
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (imageInputRef.current) imageInputRef.current.value = '';
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
            setIsUploading(false);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (fileId: number) => {
            const res = await apiRequest("DELETE", `/api/module_files.php?id=${fileId}`);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/module_files", moduleId] });
            toast({
                title: "Archivo eliminado",
                description: "El archivo ha sido eliminado correctamente.",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        }
    });

    const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!fileInputRef.current?.files?.[0]) return;

        setIsUploading(true);
        const formData = new FormData(e.currentTarget);
        formData.append("module_id", moduleId);

        if (imageInputRef.current?.files?.[0]) {
            formData.append("image", imageInputRef.current.files[0]);
        }

        uploadMutation.mutate(formData);
    };

    const handleSaveFile = async (blob: Blob) => {
        if (!editingFile) return;

        const formData = new FormData();
        formData.append("module_id", moduleId);
        formData.append("id", editingFile.id.toString());
        formData.append("title", editingFile.title);
        formData.append("description", editingFile.description);

        const file = new File([blob], editingFile.file_path.split('/').pop() || "edited.xlsx", {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
        formData.append("file", file);

        try {
            await uploadMutation.mutateAsync(formData);
            toast({
                title: "Archivo guardado",
                description: "Los cambios se guardaron correctamente.",
            });
        } catch (error) {
            console.error(error);
        }
    };

    // Exportar PDF desde LuckySheet: envia el XLSX generado al backend export_bitacora.php
    const handleExportPdf = async (blob: Blob) => {
        try {
            const form = new FormData();
            form.append("file", blob, (editingFile?.title || "bitacora") + ".xlsx");
            form.append("module_id", "modulo-4");
            form.append("title", editingFile?.title || "Bitácora");
            form.append("description", "Bitácora exportada desde LuckySheet");

            const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
            const url = `${basePath}/api/export_bitacora.php`;

            const res = await fetch(url, {
                method: "POST",
                body: form,
                credentials: "include",
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error || `Error ${res.status}`);
            }
            const data = await res.json();
            toast({
                title: "Exportado a PDF",
                description: "El archivo fue guardado y registrado en el Módulo 4.",
            });
            console.log("Export result:", data);
        } catch (e: any) {
            console.error(e);
            toast({
                title: "Error",
                description: e.message || "No se pudo exportar a PDF",
                variant: "destructive",
            });
        }
    };

    const handleSaveFileAs = async (blob: Blob, newTitle: string) => {
        if (!editingFile) return;

        const formData = new FormData();
        formData.append("module_id", moduleId);
        // Do NOT send 'id' -> creates a new record
        formData.append("title", newTitle);
        formData.append("description", editingFile.description);

        const file = new File([blob], newTitle.replace(/[^a-zA-Z0-9._-]/g, '_') + ".xlsx", {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
        formData.append("file", file);

        try {
            await uploadMutation.mutateAsync(formData);
            setEditingFile(null);
            toast({
                title: "Copia guardada",
                description: `Se ha creado "${newTitle}" como copia personal.`,
            });
        } catch (error) {
            console.error(error);
        }
    };

    const isAdmin = user?.role === 'admin';
    const isModulo4 = moduleId === 'modulo-4';

    const bitacoraActionCard = isModulo4 ? (
        <Card key="bitacora-action" className="group relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1 flex flex-col">
            <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-red-50 text-red-600 dark:bg-red-950/30">
                        <FileText className="h-8 w-8" />
                    </div>
                </div>

                <div className="space-y-2 mb-4 flex-1">
                    <h4 className="font-semibold text-lg leading-tight" title="Bitácora de Campo (Formato)">
                        Bitácora de Campo (Formato)
                    </h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                        Llena el formato oficial y genera la Bitácora en XLSX y PDF.
                    </p>
                </div>

                <div className="space-y-2 mt-auto">
                    <Button
                        variant="secondary"
                        size="lg"
                        className="w-full relative z-20 pointer-events-auto gap-2"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowBitacoraForm(true);
                        }}
                        data-testid="button-open-bitacora"
                    >
                        <Edit className="h-4 w-4" />
                        Llenar Bitácora
                    </Button>
                    <Button
                        variant="outline"
                        size="lg"
                        className="w-full relative z-20 pointer-events-auto gap-2"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowBitacoraForm(true);
                        }}
                        data-testid="button-export-bitacora-pdf"
                    >
                        <FileText className="h-4 w-4" />
                        Exportar PDF
                    </Button>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border/50 mt-4">
                    <span>XLSX + PDF</span>
                    <span>Formato oficial</span>
                </div>
            </div>
        </Card>
    ) : null;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-foreground">Archivos y Formatos</h3>
                {isAdmin && (
                    <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="gap-2">
                                <Upload className="h-4 w-4" />
                                Subir Archivo
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Subir Nuevo Archivo</DialogTitle>
                                <DialogDescription>
                                    Sube archivos PDF o Excel para que los usuarios puedan descargarlos.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleUpload} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Título</Label>
                                    <Input id="title" name="title" required placeholder="Ej. Formato de Control" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Descripción (Opcional)</Label>
                                    <Textarea id="description" name="description" placeholder="Breve descripción del archivo..." />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="file">Archivo</Label>
                                    <Input
                                        id="file"
                                        name="file"
                                        type="file"
                                        required
                                        accept=".pdf,.xls,.xlsx"
                                        ref={fileInputRef}
                                    />
                                    <p className="text-xs text-muted-foreground">Formatos permitidos: PDF, Excel (.xls, .xlsx)</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="image">Imagen de Vista Previa (Opcional)</Label>
                                    <Input
                                        id="image"
                                        name="image"
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.webp"
                                        ref={imageInputRef}
                                    />
                                    <p className="text-xs text-muted-foreground">Formatos: JPG, PNG, WEBP</p>
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={isUploading}>
                                        {isUploading ? "Subiendo..." : "Subir Archivo"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(bitacoraActionCard ? [bitacoraActionCard] : []).concat(
                    (files ?? []).map((file) => (
                        <Card key={file.id} className="group relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1 flex flex-col">
                            {file.preview_image_path && (
                                <div className="h-40 w-full overflow-hidden relative">
                                    <img
                                        src={file.preview_image_path}
                                        alt={file.title}
                                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                        onError={(e) => e.currentTarget.style.display = 'none'}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
                                    {(isAdmin || file.is_owner) && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute top-2 right-2 h-8 w-8 text-white hover:text-white hover:bg-destructive/80 z-20 pointer-events-auto"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (confirm('¿Estás seguro de eliminar este archivo?')) {
                                                    deleteMutation.mutate(file.id);
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            )}

                            <div className={`p-6 flex-1 flex flex-col ${file.preview_image_path ? 'pt-4' : ''} relative z-20 pointer-events-none`}>
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`p-3 rounded-xl ${file.file_type === 'pdf' ? 'bg-red-50 text-red-600 dark:bg-red-950/30' : 'bg-green-50 text-green-600 dark:bg-green-950/30'}`}>
                                        {file.file_type === 'pdf' ? (
                                            <FileText className="h-8 w-8" />
                                        ) : (
                                            <FileSpreadsheet className="h-8 w-8" />
                                        )}
                                    </div>
                                    {(isAdmin || file.is_owner) && !file.preview_image_path && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mt-2 -mr-2 relative z-20 pointer-events-auto"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (confirm('¿Estás seguro de eliminar este archivo?')) {
                                                    deleteMutation.mutate(file.id);
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>

                                <div className="space-y-2 mb-4 flex-1">
                                    <h4 className="font-semibold text-lg leading-tight line-clamp-2" title={file.title}>
                                        {file.title}
                                        {file.is_owner && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Mío</span>}
                                    </h4>
                                    {file.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-2" title={file.description}>
                                            {file.description}
                                        </p>
                                    )}
                                    {(file.file_type === 'excel' || file.file_type === 'pdf') && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="w-full mt-2 relative z-20 pointer-events-auto"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setEditingFile(file);
                                            }}
                                        >
                                            <span className="flex items-center">
                                                {file.file_type === 'pdf' ? (
                                                    <FileText className="h-4 w-4 mr-2" />
                                                ) : (
                                                    <Edit className="h-4 w-4 mr-2" />
                                                )}
                                                {file.file_type === 'excel' ? 'Ver / Editar' : 'Ver Archivo'}
                                            </span>
                                        </Button>
                                    )}
                                </div>

                                <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border/50 mt-auto">
                                    <span>{(file.file_size / 1024 / 1024).toFixed(2)} MB</span>
                                    <span>{new Date(file.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>

                        </Card>
                    ))
                )}
            </div>


            {/* Botón para abrir el formulario de Bitácora de Campo */}
            <div className="mt-6 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="font-semibold text-base">Bitácora de Campo Tilt Up</h4>
                        <p className="text-sm text-muted-foreground">Llena el formulario y genera tu bitácora en formato Excel con el diseño oficial.</p>
                    </div>
                    <Button
                        onClick={() => setShowBitacoraForm(true)}
                        className="gap-2"
                    >
                        <Edit className="h-4 w-4" />
                        Llenar Bitácora
                    </Button>
                </div>
            </div>

            {showBitacoraForm && createPortal(
                <BitacoraForm
                    onClose={() => setShowBitacoraForm(false)}
                // Dentro de módulo 4, solo guardamos en servidor y mostramos internamente
                />,
                document.body
            )}

            {editingFile && createPortal(
                <div className="fixed inset-0 z-[9999] bg-background w-screen h-screen">
                    {editingFile.file_type === 'excel' ? (
                        <ExcelEditorContainer
                            fileUrl={editingFile.file_path}
                            fileName={editingFile.title}
                            onClose={() => setEditingFile(null)}
                            onSave={handleSaveFile}
                            onSaveAs={handleSaveFileAs}
                            onExportPdf={handleExportPdf}
                            isOwner={editingFile.is_owner}
                            isAdmin={isAdmin}
                        />
                    ) : (
                        <div className="flex flex-col h-full bg-background no-select">
                            <div className="flex items-center justify-between p-4 border-b">
                                <h3 className="font-semibold text-lg">{editingFile.title} (Solo Lectura)</h3>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setEditingFile(null)}>
                                        <X className="h-4 w-4 mr-2" />
                                        Cerrar
                                    </Button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-hidden p-4 bg-gray-100 dark:bg-slate-900">
                                <PDFViewer
                                    pdfUrl={editingFile.file_path}
                                />
                            </div>
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}
