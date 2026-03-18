import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, Download, X, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Responsable {
    id: string;
    nombre: string;
    afiliacion: string;
    cargo: string;
}

/** Fila de la hoja C2 – Plan de manejo de residuos (columnas B–L por etapa) */
interface ResiduoRow {
    id: string;
    etapa: string;                      // A (pre-llenado)
    tipo_residuo: string;               // B
    clasificacion: string;              // C
    volumen_estimado: string;           // D
    area_acopio: string;               // E
    contenedor_metodo: string;          // F
    frecuencia_retiro: string;         // G
    empresa_transportista: string;     // H
    sitio_disposicion: string;         // I
    fecha_retiro: string;              // J
    no_manifiesto: string;             // K
    observaciones: string;             // L
}

/** Fila de la hoja C3 – Inspección del moldaje (cols C–H por criterio) */
interface MoldajeRow {
    id: string;
    criterio: string;                   // A (pre-llenado, solo lectura)
    descripcion: string;                // B (pre-llenado, solo lectura)
    cumple: string;                     // C
    nivel_dano: string;                 // D
    accion_requerida: string;           // E
    responsable: string;                // F
    fecha_compromiso: string;           // G
    observaciones: string;              // H
}

/** Fila de la hoja C4 – Carga de grúa (cols C–F por criterio) */
interface GruaRow {
    id: string;
    criterio: string;                   // A (pre-llenado)
    verificacion: string;               // B (pre-llenado)
    cumple: string;                     // C
    dato_confirmado: string;            // D
    accion_requerida: string;           // E
    observaciones: string;              // F
}

/** Fila de la hoja C5 – Instalación de insertos */
interface InsertoRow {
    id: string;
    panel_no: string;                   // A
    peso_panel: string;                 // B
    resistencia_requerida: string;      // C
    resistencia_verificada: string;     // D
    grua: string;                       // E
    operador: string;                   // F
    inserto_limpio: string;             // G
    deformaciones: string;              // H
    fisuras: string;                    // I
    capacidad_inserto: string;          // J
    capacidad_conexion: string;         // K
    seguro_activado: string;            // L
    perno_insertado: string;            // M
    rosca_completa: string;             // N
    alineacion_correcta: string;        // O
    angulo_correcto: string;            // P
}

/** Estado global del dictamen moldaje */
type DictamenMoldaje = "apto" | "condicionado" | "retiro" | "";

/** Payload completo que se envía al backend */
export interface BitacoraPayload {
    // Portada
    proyecto: string;
    ubicacion: string;
    folio: string;
    empresa_contratista: string;
    fecha_inicio_programada: string;
    fecha_termino_programada: string;
    fecha_inicio_real: string;
    fecha_termino_real: string;
    responsables: Omit<Responsable, "id">[];

    // Hojas de datos
    residuos: Omit<ResiduoRow, "id">[];
    moldaje: Omit<MoldajeRow, "id">[];
    dictamen_moldaje: DictamenMoldaje;
    justificacion_moldaje: string;
    grua: Omit<GruaRow, "id">[];
    insertos: Omit<InsertoRow, "id">[];

    // Fecha general para hojas C2-C5
    fecha_general: string;
}

interface BitacoraFormProps {
    onClose: () => void;
    apiBase?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const stripId = <T extends { id: string }>(rows: T[]): Omit<T, "id">[] =>
    rows.map(({ id, ...rest }) => rest as Omit<T, "id">);

// Etapas constructivas pre-definidas para C2
const ETAPAS_CONSTRUCTIVAS = [
    "Trazo y nivelación",
    "Cimentación y puntos de ancaje",
    "Losa de colado",
    "Cimbras o encofrados",
    "Armado de acero de refuerzo",
    "Colación de insertos y anclajes",
    "Colado de paneles",
    "Curado",
    "Desmolde",
    "Elevación, fijación y apuntalamiento de paneles",
    "Union de paneles",
    "Instalación electrica e hidraulica",
    "Diafragma (techo)",
    "Acabado",
];

// Criterios pre-definidos para C3 (Moldaje)
const CRITERIOS_MOLDAJE: { criterio: string; descripcion: string }[] = [
    { criterio: "Tipo y función correcta", descripcion: "¿Corresponde al uso previsto (losa, borde, vano, metálica)?" },
    { criterio: "Rigidez estructural", descripcion: "¿Presenta flexión, pandeo o movimiento excesivo?" },
    { criterio: "Deformaciones permanentes", descripcion: "¿Existe alabeo, torsión o pérdida de escuadra/nivel?" },
    { criterio: "Estado superficial", descripcion: "¿Hay desprendimiento, perforaciones o marcas que afecten acabado?" },
    { criterio: "Daño por humedad (madera/triplay)", descripcion: "¿Se observan hinchamientos, delaminaciones o zonas blandas?" },
    { criterio: "Uniones y fijaciones", descripcion: "¿Tornillos flojos, orificios agrandados o fisuras en conexiones?" },
    { criterio: "Reparaciones acumuladas", descripcion: "¿Ha sido parchada o reforzada repetidamente?" },
    { criterio: "Estanqueidad", descripcion: "¿Se detectan fugas de lechada durante colados previos?" },
    { criterio: "Corrosión (metálicas)", descripcion: "¿Existe reducción de sección o fisuras en soldaduras?" },
    { criterio: "Tolerancias geométricas", descripcion: "¿Ha generado desviaciones repetitivas en colados?" },
    { criterio: "Seguridad", descripcion: "¿Representa riesgo para el personal (inestabilidad, bordes sueltos)?" },
];

// Criterios pre-definidos para C4 (Grúa)
const CRITERIOS_GRUA: { criterio: string; verificacion: string }[] = [
    { criterio: "Modelo y configuración correcta", verificacion: "¿La tabla corresponde exactamente al modelo y configuración instalada?" },
    { criterio: "Configuración activa identificada", verificacion: "¿Se confirmó longitud de pluma, ángulo, jib, estabilizadores y contrapesos?" },
    { criterio: "Radio real de trabajo", verificacion: "¿Se midió el radio real desde centro de giro hasta centro de gravedad?" },
    { criterio: "Capacidad por radio (no nominal)", verificacion: "¿Se está usando el valor correspondiente al radio real y no la capacidad máxima teórica?" },
    { criterio: "Intersección correcta en tabla", verificacion: "¿Se cruzó correctamente radio vs longitud de pluma?" },
    { criterio: "Peso de gancho y aparejos", verificacion: "¿Se verificó si la tabla es bruta o neta y se sumó/descontó correctamente?" },
    { criterio: "Ángulo real de pluma", verificacion: "¿Se confirmó el ángulo efectivo durante la maniobra?" },
    { criterio: "Tipo de limitación", verificacion: "¿Se identificó si la capacidad está gobernada por estabilidad o estructura?" },
    { criterio: "Nivelación y estabilizadores", verificacion: "¿La grúa está perfectamente nivelada y con estabilizadores según tabla?" },
    { criterio: "Notas y advertencias", verificacion: "¿Se revisaron restricciones por viento, plumín, contrapesos y límites de giro?" },
    { criterio: "Margen operativo de seguridad", verificacion: "¿Existe margen razonable entre peso total y capacidad permitida?" },
    { criterio: "Validación del peso total", verificacion: "¿Se incluyeron panel, insertos, accesorios y sistema de izaje?" },
];

// ── Factories ──

const makeResponsable = (): Responsable => ({ id: uid(), nombre: "", afiliacion: "", cargo: "" });

const makeResiduoRow = (etapa: string): ResiduoRow => ({
    id: uid(), etapa, tipo_residuo: "", clasificacion: "", volumen_estimado: "",
    area_acopio: "", contenedor_metodo: "", frecuencia_retiro: "",
    empresa_transportista: "", sitio_disposicion: "", fecha_retiro: "",
    no_manifiesto: "", observaciones: "",
});

const makeMoldajeRow = (c: { criterio: string; descripcion: string }): MoldajeRow => ({
    id: uid(), criterio: c.criterio, descripcion: c.descripcion,
    cumple: "", nivel_dano: "", accion_requerida: "", responsable: "",
    fecha_compromiso: "", observaciones: "",
});

const makeGruaRow = (c: { criterio: string; verificacion: string }): GruaRow => ({
    id: uid(), criterio: c.criterio, verificacion: c.verificacion,
    cumple: "", dato_confirmado: "", accion_requerida: "", observaciones: "",
});

const makeInsertoRow = (): InsertoRow => ({
    id: uid(), panel_no: "", peso_panel: "", resistencia_requerida: "",
    resistencia_verificada: "", grua: "", operador: "", inserto_limpio: "",
    deformaciones: "", fisuras: "", capacidad_inserto: "", capacidad_conexion: "",
    seguro_activado: "", perno_insertado: "", rosca_completa: "",
    alineacion_correcta: "", angulo_correcto: "",
});

// ─── Componente Collapsible Section ───────────────────────────────────────────

function CollapsibleSection({
    title,
    defaultOpen = false,
    children,
}: {
    title: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <section className="border rounded-lg overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex items-center justify-between w-full px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
            >
                <h3 className="text-base font-semibold text-primary">{title}</h3>
                {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
            {open && <div className="p-4">{children}</div>}
        </section>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function BitacoraForm({ onClose, apiBase }: BitacoraFormProps) {
    const { toast } = useToast();

    // ── Portada ──
    const [proyecto, setProyecto] = useState("");
    const [ubicacion, setUbicacion] = useState("");
    const [folio, setFolio] = useState("");
    const [empresaContratista, setEmpresaContratista] = useState("");
    const [fechaInicioProg, setFechaInicioProg] = useState("");
    const [fechaTerminoProg, setFechaTerminoProg] = useState("");
    const [fechaInicioReal, setFechaInicioReal] = useState("");
    const [fechaTerminoReal, setFechaTerminoReal] = useState("");
    const [responsables, setResponsables] = useState<Responsable[]>([makeResponsable()]);
    const [fechaGeneral, setFechaGeneral] = useState("");

    // ── C2 Residuos ──
    const [residuos, setResiduos] = useState<ResiduoRow[]>(
        ETAPAS_CONSTRUCTIVAS.map((e) => makeResiduoRow(e))
    );

    // ── C3 Moldaje ──
    const [moldaje, setMoldaje] = useState<MoldajeRow[]>(
        CRITERIOS_MOLDAJE.map((c) => makeMoldajeRow(c))
    );
    const [dictamenMoldaje, setDictamenMoldaje] = useState<DictamenMoldaje>("");
    const [justificacionMoldaje, setJustificacionMoldaje] = useState("");

    // ── C4 Grúa ──
    const [grua, setGrua] = useState<GruaRow[]>(
        CRITERIOS_GRUA.map((c) => makeGruaRow(c))
    );

    // ── C5 Insertos ──
    const [insertos, setInsertos] = useState<InsertoRow[]>([makeInsertoRow()]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // ── Generic updater ──
    function updateRow<T extends { id: string }>(
        setter: React.Dispatch<React.SetStateAction<T[]>>,
        id: string,
        field: keyof T,
        value: string
    ) {
        setter((prev) =>
            prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
        );
    }

    // ── Submit ──
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!proyecto.trim() || !folio.trim()) {
            toast({ title: "Campos requeridos", description: "El Proyecto y el Folio son obligatorios.", variant: "destructive" });
            return;
        }

        const payload: BitacoraPayload = {
            proyecto: proyecto.trim(),
            ubicacion: ubicacion.trim(),
            folio: folio.trim(),
            empresa_contratista: empresaContratista.trim(),
            fecha_inicio_programada: fechaInicioProg,
            fecha_termino_programada: fechaTerminoProg,
            fecha_inicio_real: fechaInicioReal,
            fecha_termino_real: fechaTerminoReal,
            responsables: stripId(responsables),
            fecha_general: fechaGeneral,
            residuos: stripId(residuos),
            moldaje: stripId(moldaje),
            dictamen_moldaje: dictamenMoldaje,
            justificacion_moldaje: justificacionMoldaje,
            grua: stripId(grua),
            insertos: stripId(insertos),
        };

        setIsSubmitting(true);
        try {
            const base = (apiBase ?? import.meta.env.BASE_URL).replace(/\/$/, "");
            const url = `${base}/api/generar_bitacora.php`;

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => null);
                throw new Error(err?.error ?? `Error del servidor (${response.status})`);
            }

            const blob = await response.blob();
            const filename =
                response.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1]
                ?? `bitacora_${folio}.xlsx`;

            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(link.href);

            toast({ title: "Bitácora generada", description: `"${filename}" descargado correctamente.` });
        } catch (error: any) {
            console.error("Error al generar bitácora:", error);
            toast({ title: "Error", description: error.message || "No se pudo generar la bitácora.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    // ─── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-background overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 border-b bg-white shadow-sm shrink-0">
                <h2 className="text-lg font-semibold">Bitácora de Campo Tilt Up</h2>
                <Button variant="ghost" size="sm" onClick={onClose}>
                    <X className="h-4 w-4 mr-1" /> Cerrar
                </Button>
            </header>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-6 md:px-8 lg:px-16 space-y-6">

                {/* ═══════════════ PORTADA ═══════════════ */}
                <CollapsibleSection title="Portada — Datos Generales" defaultOpen>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <Label htmlFor="proyecto">Proyecto *</Label>
                            <Input id="proyecto" placeholder="Nombre del proyecto" value={proyecto} onChange={(e) => setProyecto(e.target.value)} required />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="folio">Folio *</Label>
                            <Input id="folio" placeholder="BC-001" value={folio} onChange={(e) => setFolio(e.target.value)} required />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="ubicacion">Ubicación</Label>
                            <Input id="ubicacion" placeholder="Ciudad / Estado" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
                        </div>
                        <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                            <Label htmlFor="empresa">Empresa Contratista Principal</Label>
                            <Input id="empresa" placeholder="Razón social" value={empresaContratista} onChange={(e) => setEmpresaContratista(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Fecha inicio programada</Label>
                            <Input type="date" value={fechaInicioProg} onChange={(e) => setFechaInicioProg(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Fecha término programada</Label>
                            <Input type="date" value={fechaTerminoProg} onChange={(e) => setFechaTerminoProg(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Fecha inicio real</Label>
                            <Input type="date" value={fechaInicioReal} onChange={(e) => setFechaInicioReal(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Fecha término real</Label>
                            <Input type="date" value={fechaTerminoReal} onChange={(e) => setFechaTerminoReal(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Fecha general (para hojas C2–C5)</Label>
                            <Input type="date" value={fechaGeneral} onChange={(e) => setFechaGeneral(e.target.value)} />
                        </div>
                    </div>

                    {/* Responsables */}
                    <div className="mt-6">
                        <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-semibold">Responsables en obra</Label>
                            <Button type="button" variant="outline" size="sm" onClick={() => setResponsables((p) => [...p, makeResponsable()])} className="gap-1">
                                <Plus className="h-3 w-3" /> Agregar
                            </Button>
                        </div>
                        <div className="hidden md:grid md:grid-cols-[1fr_1fr_1fr_auto] gap-2 mb-1 text-xs font-medium text-muted-foreground px-1">
                            <span>Nombre</span><span>Afiliación</span><span>Cargo</span><span className="w-9" />
                        </div>
                        <div className="space-y-2">
                            {responsables.map((r) => (
                                <div key={r.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center bg-muted/30 rounded-md p-2">
                                    <Input placeholder="Nombre" value={r.nombre} onChange={(e) => updateRow(setResponsables, r.id, "nombre", e.target.value)} />
                                    <Input placeholder="Afiliación" value={r.afiliacion} onChange={(e) => updateRow(setResponsables, r.id, "afiliacion", e.target.value)} />
                                    <Input placeholder="Cargo" value={r.cargo} onChange={(e) => updateRow(setResponsables, r.id, "cargo", e.target.value)} />
                                    <Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setResponsables((p) => p.filter((x) => x.id !== r.id))} disabled={responsables.length <= 1}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </CollapsibleSection>

                {/* ═══════════════ C2 — PLAN DE MANEJO DE RESIDUOS ═══════════════ */}
                <CollapsibleSection title="C2 — Plan de Manejo de Residuos">
                    <p className="text-sm text-muted-foreground mb-4">Completa las columnas para cada etapa constructiva. Las etapas ya están pre-llenadas según la plantilla.</p>
                    <div className="overflow-x-auto">
                        <table className="min-w-[1200px] w-full text-sm">
                            <thead>
                                <tr className="border-b text-xs font-medium text-muted-foreground">
                                    <th className="text-left p-2 w-48">Etapa</th>
                                    <th className="text-left p-2">Tipo Residuo</th>
                                    <th className="text-left p-2">Clasif.</th>
                                    <th className="text-left p-2">Vol. Est.</th>
                                    <th className="text-left p-2">Área Acopio</th>
                                    <th className="text-left p-2">Contenedor</th>
                                    <th className="text-left p-2">Frec. Retiro</th>
                                    <th className="text-left p-2">Emp. Transp.</th>
                                    <th className="text-left p-2">Sitio Disp.</th>
                                    <th className="text-left p-2">Fecha Retiro</th>
                                    <th className="text-left p-2">No. Manif.</th>
                                    <th className="text-left p-2">Observaciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {residuos.map((row) => (
                                    <tr key={row.id} className="border-b last:border-0">
                                        <td className="p-1 text-xs font-medium text-muted-foreground whitespace-nowrap">{row.etapa}</td>
                                        <td className="p-1"><Input className="h-8 text-xs" value={row.tipo_residuo} onChange={(e) => updateRow(setResiduos, row.id, "tipo_residuo", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs" value={row.clasificacion} onChange={(e) => updateRow(setResiduos, row.id, "clasificacion", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs" value={row.volumen_estimado} onChange={(e) => updateRow(setResiduos, row.id, "volumen_estimado", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs" value={row.area_acopio} onChange={(e) => updateRow(setResiduos, row.id, "area_acopio", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs" value={row.contenedor_metodo} onChange={(e) => updateRow(setResiduos, row.id, "contenedor_metodo", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs" value={row.frecuencia_retiro} onChange={(e) => updateRow(setResiduos, row.id, "frecuencia_retiro", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs" value={row.empresa_transportista} onChange={(e) => updateRow(setResiduos, row.id, "empresa_transportista", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs" value={row.sitio_disposicion} onChange={(e) => updateRow(setResiduos, row.id, "sitio_disposicion", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs" type="date" value={row.fecha_retiro} onChange={(e) => updateRow(setResiduos, row.id, "fecha_retiro", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs" value={row.no_manifiesto} onChange={(e) => updateRow(setResiduos, row.id, "no_manifiesto", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs" value={row.observaciones} onChange={(e) => updateRow(setResiduos, row.id, "observaciones", e.target.value)} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CollapsibleSection>

                {/* ═══════════════ C3 — INSPECCIÓN DE MOLDAJE ═══════════════ */}
                <CollapsibleSection title="C3 — Inspección Previa del Material de Moldaje">
                    <p className="text-sm text-muted-foreground mb-4">Evalúa cada criterio de inspección. Los criterios y descripciones son de solo lectura.</p>
                    <div className="overflow-x-auto">
                        <table className="min-w-[900px] w-full text-sm">
                            <thead>
                                <tr className="border-b text-xs font-medium text-muted-foreground">
                                    <th className="text-left p-2 w-40">Criterio</th>
                                    <th className="text-left p-2 w-64">Descripción</th>
                                    <th className="text-left p-2 w-24">Cumple</th>
                                    <th className="text-left p-2 w-28">Nivel daño</th>
                                    <th className="text-left p-2">Acción requerida</th>
                                    <th className="text-left p-2">Responsable</th>
                                    <th className="text-left p-2 w-32">Fecha comp.</th>
                                    <th className="text-left p-2">Observaciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {moldaje.map((row) => (
                                    <tr key={row.id} className="border-b last:border-0">
                                        <td className="p-1 text-xs font-medium text-muted-foreground">{row.criterio}</td>
                                        <td className="p-1 text-xs text-muted-foreground">{row.descripcion}</td>
                                        <td className="p-1">
                                            <Select value={row.cumple} onValueChange={(v) => updateRow(setMoldaje, row.id, "cumple", v)}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Sí">Sí</SelectItem>
                                                    <SelectItem value="No">No</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        <td className="p-1">
                                            <Select value={row.nivel_dano} onValueChange={(v) => updateRow(setMoldaje, row.id, "nivel_dano", v)}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Bajo">Bajo</SelectItem>
                                                    <SelectItem value="Medio">Medio</SelectItem>
                                                    <SelectItem value="Alto">Alto</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        <td className="p-1"><Input className="h-8 text-xs" value={row.accion_requerida} onChange={(e) => updateRow(setMoldaje, row.id, "accion_requerida", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs" value={row.responsable} onChange={(e) => updateRow(setMoldaje, row.id, "responsable", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs" type="date" value={row.fecha_compromiso} onChange={(e) => updateRow(setMoldaje, row.id, "fecha_compromiso", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs" value={row.observaciones} onChange={(e) => updateRow(setMoldaje, row.id, "observaciones", e.target.value)} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Dictamen */}
                    <div className="mt-4 space-y-3 border-t pt-4">
                        <Label className="text-sm font-semibold">Dictamen</Label>
                        <div className="flex flex-wrap gap-4">
                            {([
                                ["apto", "Apto para uso inmediato"],
                                ["condicionado", "Uso condicionado (requiere reparación)"],
                                ["retiro", "Retiro definitivo"],
                            ] as const).map(([val, label]) => (
                                <label key={val} className="flex items-center gap-2 cursor-pointer text-sm">
                                    <input type="radio" name="dictamen" value={val} checked={dictamenMoldaje === val} onChange={() => setDictamenMoldaje(val)} className="accent-primary" />
                                    {label}
                                </label>
                            ))}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="justificacion">Justificación técnica del dictamen</Label>
                            <textarea
                                id="justificacion"
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={justificacionMoldaje}
                                onChange={(e) => setJustificacionMoldaje(e.target.value)}
                                placeholder="Escriba la justificación técnica..."
                            />
                        </div>
                    </div>
                </CollapsibleSection>

                {/* ═══════════════ C4 — CARGA DE GRÚA ═══════════════ */}
                <CollapsibleSection title="C4 — Carga de Grúa">
                    <p className="text-sm text-muted-foreground mb-4">Verifica cada criterio de la tabla de carga de la grúa.</p>
                    <div className="overflow-x-auto">
                        <table className="min-w-[800px] w-full text-sm">
                            <thead>
                                <tr className="border-b text-xs font-medium text-muted-foreground">
                                    <th className="text-left p-2 w-48">Criterio</th>
                                    <th className="text-left p-2 w-64">Verificación</th>
                                    <th className="text-left p-2 w-24">Cumple</th>
                                    <th className="text-left p-2">Dato confirmado</th>
                                    <th className="text-left p-2">Acción requerida</th>
                                    <th className="text-left p-2">Observaciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {grua.map((row) => (
                                    <tr key={row.id} className="border-b last:border-0">
                                        <td className="p-1 text-xs font-medium text-muted-foreground">{row.criterio}</td>
                                        <td className="p-1 text-xs text-muted-foreground">{row.verificacion}</td>
                                        <td className="p-1">
                                            <Select value={row.cumple} onValueChange={(v) => updateRow(setGrua, row.id, "cumple", v)}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Sí">Sí</SelectItem>
                                                    <SelectItem value="No">No</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        <td className="p-1"><Input className="h-8 text-xs" value={row.dato_confirmado} onChange={(e) => updateRow(setGrua, row.id, "dato_confirmado", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs" value={row.accion_requerida} onChange={(e) => updateRow(setGrua, row.id, "accion_requerida", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs" value={row.observaciones} onChange={(e) => updateRow(setGrua, row.id, "observaciones", e.target.value)} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CollapsibleSection>

                {/* ═══════════════ C5 — INSTALACIÓN DE INSERTOS ═══════════════ */}
                <CollapsibleSection title="C5 — Instalación de Insertos">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-muted-foreground">Registra la información de cada panel. Agrega filas según sea necesario.</p>
                        <Button type="button" variant="outline" size="sm" onClick={() => setInsertos((p) => [...p, makeInsertoRow()])} className="gap-1">
                            <Plus className="h-4 w-4" /> Agregar panel
                        </Button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-[1400px] w-full text-sm">
                            <thead>
                                <tr className="border-b text-xs font-medium text-muted-foreground">
                                    <th className="p-2">Panel No.</th>
                                    <th className="p-2">Peso (ton)</th>
                                    <th className="p-2">Resist. Req.</th>
                                    <th className="p-2">Resist. Verif.</th>
                                    <th className="p-2">Grúa</th>
                                    <th className="p-2">Operador</th>
                                    <th className="p-2">Inserto limpio</th>
                                    <th className="p-2">Deform.</th>
                                    <th className="p-2">Fisuras</th>
                                    <th className="p-2">Cap. Inserto</th>
                                    <th className="p-2">Cap. Conexión</th>
                                    <th className="p-2">Seguro</th>
                                    <th className="p-2">Perno</th>
                                    <th className="p-2">Rosca</th>
                                    <th className="p-2">Alineación</th>
                                    <th className="p-2">Ángulo</th>
                                    <th className="p-2 w-9"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {insertos.map((row) => (
                                    <tr key={row.id} className="border-b last:border-0">
                                        <td className="p-1"><Input className="h-8 text-xs w-16" value={row.panel_no} onChange={(e) => updateRow(setInsertos, row.id, "panel_no", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs w-16" value={row.peso_panel} onChange={(e) => updateRow(setInsertos, row.id, "peso_panel", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs w-20" value={row.resistencia_requerida} onChange={(e) => updateRow(setInsertos, row.id, "resistencia_requerida", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs w-20" value={row.resistencia_verificada} onChange={(e) => updateRow(setInsertos, row.id, "resistencia_verificada", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs w-20" value={row.grua} onChange={(e) => updateRow(setInsertos, row.id, "grua", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs w-20" value={row.operador} onChange={(e) => updateRow(setInsertos, row.id, "operador", e.target.value)} /></td>
                                        <td className="p-1">
                                            <Select value={row.inserto_limpio} onValueChange={(v) => updateRow(setInsertos, row.id, "inserto_limpio", v)}>
                                                <SelectTrigger className="h-8 text-xs w-16"><SelectValue placeholder="—" /></SelectTrigger>
                                                <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                                            </Select>
                                        </td>
                                        <td className="p-1">
                                            <Select value={row.deformaciones} onValueChange={(v) => updateRow(setInsertos, row.id, "deformaciones", v)}>
                                                <SelectTrigger className="h-8 text-xs w-16"><SelectValue placeholder="—" /></SelectTrigger>
                                                <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                                            </Select>
                                        </td>
                                        <td className="p-1">
                                            <Select value={row.fisuras} onValueChange={(v) => updateRow(setInsertos, row.id, "fisuras", v)}>
                                                <SelectTrigger className="h-8 text-xs w-16"><SelectValue placeholder="—" /></SelectTrigger>
                                                <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                                            </Select>
                                        </td>
                                        <td className="p-1"><Input className="h-8 text-xs w-20" value={row.capacidad_inserto} onChange={(e) => updateRow(setInsertos, row.id, "capacidad_inserto", e.target.value)} /></td>
                                        <td className="p-1"><Input className="h-8 text-xs w-20" value={row.capacidad_conexion} onChange={(e) => updateRow(setInsertos, row.id, "capacidad_conexion", e.target.value)} /></td>
                                        <td className="p-1">
                                            <Select value={row.seguro_activado} onValueChange={(v) => updateRow(setInsertos, row.id, "seguro_activado", v)}>
                                                <SelectTrigger className="h-8 text-xs w-16"><SelectValue placeholder="—" /></SelectTrigger>
                                                <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem><SelectItem value="N/A">N/A</SelectItem></SelectContent>
                                            </Select>
                                        </td>
                                        <td className="p-1">
                                            <Select value={row.perno_insertado} onValueChange={(v) => updateRow(setInsertos, row.id, "perno_insertado", v)}>
                                                <SelectTrigger className="h-8 text-xs w-16"><SelectValue placeholder="—" /></SelectTrigger>
                                                <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem><SelectItem value="N/A">N/A</SelectItem></SelectContent>
                                            </Select>
                                        </td>
                                        <td className="p-1">
                                            <Select value={row.rosca_completa} onValueChange={(v) => updateRow(setInsertos, row.id, "rosca_completa", v)}>
                                                <SelectTrigger className="h-8 text-xs w-16"><SelectValue placeholder="—" /></SelectTrigger>
                                                <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem><SelectItem value="N/A">N/A</SelectItem></SelectContent>
                                            </Select>
                                        </td>
                                        <td className="p-1">
                                            <Select value={row.alineacion_correcta} onValueChange={(v) => updateRow(setInsertos, row.id, "alineacion_correcta", v)}>
                                                <SelectTrigger className="h-8 text-xs w-16"><SelectValue placeholder="—" /></SelectTrigger>
                                                <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                                            </Select>
                                        </td>
                                        <td className="p-1">
                                            <Select value={row.angulo_correcto} onValueChange={(v) => updateRow(setInsertos, row.id, "angulo_correcto", v)}>
                                                <SelectTrigger className="h-8 text-xs w-16"><SelectValue placeholder="—" /></SelectTrigger>
                                                <SelectContent><SelectItem value="Sí">Sí</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                                            </Select>
                                        </td>
                                        <td className="p-1">
                                            <Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setInsertos((p) => p.filter((x) => x.id !== row.id))} disabled={insertos.length <= 1}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CollapsibleSection>

                {/* ═══════════════ SUBMIT ═══════════════ */}
                <div className="flex justify-end pt-4 border-t">
                    <Button type="submit" size="lg" disabled={isSubmitting} className="gap-2 min-w-[220px]">
                        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                        {isSubmitting ? "Generando…" : "Generar Bitácora (.xlsx)"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
