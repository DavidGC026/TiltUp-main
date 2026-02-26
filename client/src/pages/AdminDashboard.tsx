import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { Link, useLocation } from "wouter";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Eye, XCircle, CheckCircle2, ShieldCheck, CreditCard, UserCheck, Ban, Link2, Settings, Users } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { UserManagement } from "@/components/UserManagement";
import { useToast } from "@/hooks/use-toast";

interface ExamResultDetail {
    questionId: string;
    questionText: string;
    selectedOptionId: string;
    selectedOptionText: string;
    correctOptionId: string;
    correctOptionText: string;
    isCorrect: boolean;
}

interface AdminResult {
    user_id: number;
    username: string;
    result_id: number;
    exam_id: string;
    exam_title: string;
    attempt_id: string;
    score: number;
    passed: boolean;
    created_at: string;
    details: ExamResultDetail[];
}

interface ExamPermission {
    id: number;
    user_id: number;
    username: string;
    exam_id: string;
    exam_title: string;
    module_id: string;
    module_title: string;
    granted_by: number;
    granted_by_username: string;
    granted_at: string;
    is_active: boolean;
    notes: string | null;
}

interface PaymentRecord {
    id: string;
    user_id: number;
    username: string;
    module_id: string;
    module_title: string;
    exam_id: string | null;
    amount: number;
    status: string;
    created_at: string;
    approved_by: number | null;
    approved_at: string | null;
    admin_notes: string | null;
}

interface ExamInfo {
    id: string;
    title: string;
    requires_payment: boolean;
    payment_amount: number;
    payment_link: string | null;
    section_id: string;
    module_id: string;
    section_type: string;
    module_title: string;
    module_number: number;
}

interface UserInfo {
    id: number;
    username: string;
    role: string;
}

interface PermissionsData {
    permissions: ExamPermission[];
    payments: PaymentRecord[];
    exams_requiring_payment: ExamInfo[];
}

export default function AdminDashboard() {
    const { user, loading } = useAuth();
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: results, isLoading } = useQuery<AdminResult[]>({
        queryKey: ["/api/admin_results"],
        enabled: !!user && user.role === "admin",
    });

    const { data: permissionsData, isLoading: permissionsLoading } = useQuery<PermissionsData>({
        queryKey: ["/api/exam_permissions", "list"],
        enabled: !!user && user.role === "admin",
        queryFn: async () => {
            const res = await fetch(`/api/exam_permissions.php?action=list`);
            if (!res.ok) throw new Error("Failed to fetch permissions");
            return res.json();
        },
    });

    const { data: allUsers } = useQuery<UserInfo[]>({
        queryKey: ["/api/exam_permissions", "users"],
        enabled: !!user && user.role === "admin",
        queryFn: async () => {
            const res = await fetch(`/api/exam_permissions.php?action=users`);
            if (!res.ok) throw new Error("Failed to fetch users");
            return res.json();
        },
    });

    const { data: allExams } = useQuery<ExamInfo[]>({
        queryKey: ["/api/exam_permissions", "exams"],
        enabled: !!user && user.role === "admin",
        queryFn: async () => {
            const res = await fetch(`/api/exam_permissions.php?action=exams`);
            if (!res.ok) throw new Error("Failed to fetch exams");
            return res.json();
        },
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user || user.role !== "admin") {
        setLocation("/");
        return null;
    }

    const pendingPayments = permissionsData?.payments?.filter(p => p.status === 'pending') || [];
    const processedPayments = permissionsData?.payments?.filter(p => p.status !== 'pending') || [];
    const activePermissions = permissionsData?.permissions?.filter(p => p.is_active) || [];

    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold">Panel de Administración</h1>
                    <Link href="/">
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver al Inicio
                        </Button>
                    </Link>
                </div>

                <Tabs defaultValue="users" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="users" className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Usuarios
                        </TabsTrigger>
                        <TabsTrigger value="payments" className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Pagos
                            {pendingPayments.length > 0 && (
                                <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0.5">
                                    {pendingPayments.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="permissions" className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4" />
                            Permisos
                        </TabsTrigger>
                        <TabsTrigger value="config" className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Config
                        </TabsTrigger>
                        <TabsTrigger value="results" className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            Resultados
                        </TabsTrigger>
                    </TabsList>

                    {/* TAB: User Management */}
                    <TabsContent value="users">
                        <UserManagement />
                    </TabsContent>

                    {/* TAB: Payments Management */}
                    <TabsContent value="payments">
                        <div className="space-y-6">
                            {/* Pending Payments */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <CreditCard className="h-5 w-5 text-amber-600" />
                                        Pagos Pendientes de Aprobación
                                        {pendingPayments.length > 0 && (
                                            <Badge variant="destructive">{pendingPayments.length}</Badge>
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {permissionsLoading ? (
                                        <div className="flex justify-center p-8">
                                            <Loader2 className="h-8 w-8 animate-spin" />
                                        </div>
                                    ) : pendingPayments.length > 0 ? (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Usuario</TableHead>
                                                    <TableHead>Módulo</TableHead>
                                                    <TableHead>Monto</TableHead>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead>Acciones</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {pendingPayments.map((payment) => (
                                                    <PaymentActionRow
                                                        key={payment.id}
                                                        payment={payment}
                                                        queryClient={queryClient}
                                                        toast={toast}
                                                    />
                                                ))}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground">
                                            No hay pagos pendientes de aprobación.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Payment History */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Historial de Pagos</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {processedPayments.length > 0 ? (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Usuario</TableHead>
                                                    <TableHead>Módulo</TableHead>
                                                    <TableHead>Monto</TableHead>
                                                    <TableHead>Estado</TableHead>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead>Notas</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {processedPayments.map((payment) => (
                                                    <TableRow key={payment.id}>
                                                        <TableCell className="font-medium">{payment.username}</TableCell>
                                                        <TableCell>{payment.module_title || payment.module_id}</TableCell>
                                                        <TableCell>${payment.amount.toFixed(2)}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={payment.status === 'completed' ? 'default' : 'destructive'}>
                                                                {payment.status === 'completed' ? 'Aprobado' : 'Rechazado'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>{new Date(payment.created_at).toLocaleString()}</TableCell>
                                                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                                            {payment.admin_notes || '-'}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground">
                                            No hay historial de pagos procesados.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* TAB: Exam Access Permissions */}
                    <TabsContent value="permissions">
                        <div className="space-y-6">
                            {/* Grant Permission Form */}
                            <GrantPermissionCard
                                users={allUsers || []}
                                exams={allExams || []}
                                queryClient={queryClient}
                                toast={toast}
                            />

                            {/* Active Permissions */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <UserCheck className="h-5 w-5 text-green-600" />
                                        Permisos Activos
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {permissionsLoading ? (
                                        <div className="flex justify-center p-8">
                                            <Loader2 className="h-8 w-8 animate-spin" />
                                        </div>
                                    ) : activePermissions.length > 0 ? (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Usuario</TableHead>
                                                    <TableHead>Examen</TableHead>
                                                    <TableHead>Módulo</TableHead>
                                                    <TableHead>Otorgado por</TableHead>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead>Notas</TableHead>
                                                    <TableHead>Acciones</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {activePermissions.map((perm) => (
                                                    <PermissionRow
                                                        key={perm.id}
                                                        permission={perm}
                                                        queryClient={queryClient}
                                                        toast={toast}
                                                    />
                                                ))}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground">
                                            No hay permisos activos. Use el formulario de arriba para otorgar acceso.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* TAB: Exam Configuration (Payment Links) */}
                    <TabsContent value="config">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Link2 className="h-5 w-5 text-blue-600" />
                                    Configuración de Exámenes y Enlaces de Pago
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Configure enlaces de pago de Conekta (u otro proveedor) para cada examen final.
                                    Cada examen tiene su propio enlace de pago independiente.
                                </p>
                                {allExams && allExams.length > 0 ? (
                                    <div className="space-y-4">
                                        {allExams.map((exam) => (
                                            <ExamConfigRow
                                                key={exam.id}
                                                exam={exam}
                                                queryClient={queryClient}
                                                toast={toast}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No hay exámenes configurados.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB: Exam Results */}
                    <TabsContent value="results">
                        <Card>
                            <CardHeader>
                                <CardTitle>Resultados de Exámenes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="flex justify-center p-8">
                                        <Loader2 className="h-8 w-8 animate-spin" />
                                    </div>
                                ) : results && results.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Usuario</TableHead>
                                                <TableHead>Examen</TableHead>
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>Calificación</TableHead>
                                                <TableHead>Estado</TableHead>
                                                <TableHead>Detalles</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {results.map((result) => (
                                                <TableRow key={result.result_id}>
                                                    <TableCell className="font-medium">{result.username}</TableCell>
                                                    <TableCell>{result.exam_title}</TableCell>
                                                    <TableCell>{new Date(result.created_at).toLocaleString()}</TableCell>
                                                    <TableCell>{result.score.toFixed(1)}%</TableCell>
                                                    <TableCell>
                                                        <Badge variant={result.passed ? "default" : "destructive"}>
                                                            {result.passed ? "Aprobado" : "Reprobado"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <DetailsDialog result={result} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No hay resultados registrados aún.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}

// ==========================================
// Sub-components
// ==========================================

function PaymentActionRow({
    payment,
    queryClient: qc,
    toast,
}: {
    payment: PaymentRecord;
    queryClient: ReturnType<typeof useQueryClient>;
    toast: ReturnType<typeof useToast>["toast"];
}) {
    const [notes, setNotes] = useState("");

    const approveMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/exam_permissions.php?action=approve_payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'approve_payment', payment_id: payment.id, notes }),
            });
            if (!res.ok) throw new Error("Failed to approve");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Pago aprobado", description: `Se aprobó el pago de ${payment.username}` });
            qc.invalidateQueries({ queryKey: ["/api/exam_permissions"] });
        },
    });

    const rejectMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/exam_permissions.php?action=reject_payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reject_payment', payment_id: payment.id, notes }),
            });
            if (!res.ok) throw new Error("Failed to reject");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Pago rechazado", description: `Se rechazó el pago de ${payment.username}`, variant: "destructive" });
            qc.invalidateQueries({ queryKey: ["/api/exam_permissions"] });
        },
    });

    return (
        <TableRow>
            <TableCell className="font-medium">{payment.username}</TableCell>
            <TableCell>{payment.module_title || payment.module_id}</TableCell>
            <TableCell>${payment.amount.toFixed(2)}</TableCell>
            <TableCell>{new Date(payment.created_at).toLocaleString()}</TableCell>
            <TableCell>
                <div className="flex flex-col gap-2">
                    <Textarea
                        placeholder="Notas del admin (opcional)"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="text-xs h-16 min-h-0"
                    />
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="default"
                            onClick={() => approveMutation.mutate()}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {approveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                            Aprobar
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectMutation.mutate()}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                        >
                            {rejectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                            Rechazar
                        </Button>
                    </div>
                </div>
            </TableCell>
        </TableRow>
    );
}

function PermissionRow({
    permission,
    queryClient: qc,
    toast,
}: {
    permission: ExamPermission;
    queryClient: ReturnType<typeof useQueryClient>;
    toast: ReturnType<typeof useToast>["toast"];
}) {
    const revokeMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/exam_permissions.php?action=revoke`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'revoke', permission_id: permission.id }),
            });
            if (!res.ok) throw new Error("Failed to revoke");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Permiso revocado", description: `Se revocó acceso al examen para ${permission.username}`, variant: "destructive" });
            qc.invalidateQueries({ queryKey: ["/api/exam_permissions"] });
        },
    });

    return (
        <TableRow>
            <TableCell className="font-medium">{permission.username}</TableCell>
            <TableCell>{permission.exam_title}</TableCell>
            <TableCell>{permission.module_title}</TableCell>
            <TableCell>{permission.granted_by_username}</TableCell>
            <TableCell>{new Date(permission.granted_at).toLocaleString()}</TableCell>
            <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                {permission.notes || '-'}
            </TableCell>
            <TableCell>
                <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => revokeMutation.mutate()}
                    disabled={revokeMutation.isPending}
                >
                    {revokeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3 mr-1" />}
                    Revocar
                </Button>
            </TableCell>
        </TableRow>
    );
}

function GrantPermissionCard({
    users,
    exams,
    queryClient: qc,
    toast,
}: {
    users: UserInfo[];
    exams: ExamInfo[];
    queryClient: ReturnType<typeof useQueryClient>;
    toast: ReturnType<typeof useToast>["toast"];
}) {
    const [selectedUser, setSelectedUser] = useState("");
    const [selectedExam, setSelectedExam] = useState("");
    const [notes, setNotes] = useState("");

    const grantMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/exam_permissions.php?action=grant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'grant',
                    user_id: parseInt(selectedUser),
                    exam_id: selectedExam,
                    notes,
                }),
            });
            if (!res.ok) throw new Error("Failed to grant");
            return res.json();
        },
        onSuccess: (data: { already_exists?: boolean }) => {
            if (data.already_exists) {
                toast({ title: "Permiso existente", description: "El usuario ya tiene permiso para este examen." });
            } else {
                toast({ title: "Permiso otorgado", description: "Se otorgó acceso al examen exitosamente." });
            }
            qc.invalidateQueries({ queryKey: ["/api/exam_permissions"] });
            setSelectedUser("");
            setSelectedExam("");
            setNotes("");
        },
        onError: () => {
            toast({ title: "Error", description: "No se pudo otorgar el permiso.", variant: "destructive" });
        },
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-blue-600" />
                    Otorgar Acceso a Examen
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-sm font-medium mb-1 block">Usuario</label>
                        <Select value={selectedUser} onValueChange={setSelectedUser}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar usuario" />
                            </SelectTrigger>
                            <SelectContent>
                                {users.map((u) => (
                                    <SelectItem key={u.id} value={u.id.toString()}>
                                        {u.username}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Examen</label>
                        <Select value={selectedExam} onValueChange={setSelectedExam}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar examen" />
                            </SelectTrigger>
                            <SelectContent>
                                {exams.map((e) => (
                                    <SelectItem key={e.id} value={e.id}>
                                        {e.module_title} - {e.title}
                                        {e.requires_payment && " 💰"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Notas (opcional)</label>
                        <Textarea
                            placeholder="Notas..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="h-10 min-h-0"
                        />
                    </div>
                    <Button
                        onClick={() => grantMutation.mutate()}
                        disabled={!selectedUser || !selectedExam || grantMutation.isPending}
                    >
                        {grantMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <UserCheck className="h-4 w-4 mr-2" />
                        )}
                        Otorgar Acceso
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function ExamConfigRow({
    exam,
    queryClient: qc,
    toast,
}: {
    exam: ExamInfo;
    queryClient: ReturnType<typeof useQueryClient>;
    toast: ReturnType<typeof useToast>["toast"];
}) {
    const [paymentLink, setPaymentLink] = useState(exam.payment_link || "");
    const [requiresPayment, setRequiresPayment] = useState(exam.requires_payment);
    const [paymentAmount, setPaymentAmount] = useState(exam.payment_amount.toString());

    const updateMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/exam_permissions.php?action=update_exam`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_exam',
                    exam_id: exam.id,
                    requires_payment: requiresPayment,
                    payment_amount: parseFloat(paymentAmount) || 1000,
                    payment_link: paymentLink || null,
                }),
            });
            if (!res.ok) throw new Error("Failed to update");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Examen actualizado", description: `Se actualizó la configuración de "${exam.title}"` });
            qc.invalidateQueries({ queryKey: ["/api/exam_permissions"] });
        },
        onError: () => {
            toast({ title: "Error", description: "No se pudo actualizar la configuración.", variant: "destructive" });
        },
    });

    const sectionTypeLabel = exam.section_type === 'evaluation' ? '📋 Examen Final' : '📝 Diagnóstico';

    return (
        <Card className="p-4 border">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <Badge variant={exam.section_type === 'evaluation' ? 'default' : 'secondary'}>
                            {sectionTypeLabel}
                        </Badge>
                        <span className="text-sm text-muted-foreground">Módulo {exam.module_number}</span>
                    </div>
                    <h4 className="font-semibold">{exam.module_title} — {exam.title}</h4>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Requiere pago</label>
                    <Switch
                        checked={requiresPayment}
                        onCheckedChange={setRequiresPayment}
                    />
                </div>
            </div>

            {requiresPayment && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">
                            Monto ($MXN)
                        </label>
                        <Input
                            type="number"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            placeholder="1000"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">
                            Enlace de Pago (Conekta/PayPal)
                        </label>
                        <Input
                            value={paymentLink}
                            onChange={(e) => setPaymentLink(e.target.value)}
                            placeholder="https://pay.conekta.com/link/..."
                        />
                    </div>
                    <Button
                        onClick={() => updateMutation.mutate()}
                        disabled={updateMutation.isPending}
                        size="sm"
                    >
                        {updateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                        )}
                        Guardar
                    </Button>
                </div>
            )}

            {!requiresPayment && (
                <div className="mt-3">
                    <Button
                        onClick={() => updateMutation.mutate()}
                        disabled={updateMutation.isPending}
                        size="sm"
                        variant="outline"
                    >
                        {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                        Guardar cambios
                    </Button>
                </div>
            )}
        </Card>
    );
}

function DetailsDialog({ result }: { result: AdminResult }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    Ver
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Detalles del Intento - {result.username}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Examen</p>
                        <p>{result.exam_title}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Fecha</p>
                        <p>{new Date(result.created_at).toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Calificación</p>
                        <p className="text-xl font-bold">{result.score.toFixed(1)}%</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Estado</p>
                        <Badge variant={result.passed ? "default" : "destructive"}>
                            {result.passed ? "Aprobado" : "Reprobado"}
                        </Badge>
                    </div>
                </div>

                <div className="border rounded-md p-4">
                    <h3 className="text-md font-semibold mb-2">Respuestas ({result.details.length})</h3>
                    <div className="space-y-2">
                        {result.details.map((detail, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm border-b pb-2 last:border-0">
                                {detail.isCorrect ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                                ) : (
                                    <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                                )}
                                <div>
                                    <p className="font-medium">Pregunta: {detail.questionText}</p>
                                    <p className="text-muted-foreground">Seleccionada: {detail.selectedOptionText}</p>
                                    {!detail.isCorrect && (
                                        <p className="text-green-600">Correcta: {detail.correctOptionText}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
