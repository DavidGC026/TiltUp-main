import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Loader2,
    UserPlus,
    Trash2,
    Clock,
    RefreshCw,
    Search,
    UserX,
    UserCheck,
    Timer,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ManagedUser {
    id: number;
    username: string;
    email: string | null;
    display_name: string | null;
    role: string;
    access_expires_at: string | null;
    access_duration_days: number | null;
    account_status: string;
    created_at: string;
    updated_at: string;
    created_by: number | null;
    time_remaining_seconds: number | null;
    time_remaining_text: string;
    time_remaining_percent: number;
}

const DURATION_PRESETS = [
    { label: "24 horas", days: 1 },
    { label: "48 horas", days: 2 },
    { label: "72 horas", days: 3 },
    { label: "1 semana", days: 7 },
    { label: "1 mes", days: 30 },
    { label: "3 meses", days: 90 },
    { label: "6 meses", days: 180 },
    { label: "1 año", days: 365 },
    { label: "Permanente", days: 0 },
];

export function UserManagement() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [searchFilter, setSearchFilter] = useState("");

    const { data: users, isLoading } = useQuery<ManagedUser[]>({
        queryKey: ["/api/user_management", "list"],
        queryFn: async () => {
            const res = await fetch(`/api/user_management.php?action=list`);
            if (!res.ok) throw new Error("Failed to fetch users");
            return res.json();
        },
    });

    const filteredUsers = users?.filter(u => {
        if (!searchFilter) return true;
        const q = searchFilter.toLowerCase();
        return (
            u.username.toLowerCase().includes(q) ||
            (u.email && u.email.toLowerCase().includes(q)) ||
            (u.display_name && u.display_name.toLowerCase().includes(q))
        );
    });

    return (
        <div className="space-y-6">
            {/* Create User Form */}
            <CreateUserCard queryClient={queryClient} toast={toast} />

            {/* Users Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            Usuarios Registrados
                            {users && <Badge variant="secondary">{users.length}</Badge>}
                        </CardTitle>
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre o correo..."
                                value={searchFilter}
                                onChange={(e) => setSearchFilter(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : filteredUsers && filteredUsers.length > 0 ? (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Usuario</TableHead>
                                        <TableHead>Correo</TableHead>
                                        <TableHead>Rol</TableHead>
                                        <TableHead>Registro</TableHead>
                                        <TableHead>Expiración</TableHead>
                                        <TableHead>Tiempo Restante</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.map((user) => (
                                        <UserRow
                                            key={user.id}
                                            user={user}
                                            queryClient={queryClient}
                                            toast={toast}
                                        />
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            {searchFilter ? "No se encontraron usuarios con ese criterio." : "No hay usuarios registrados."}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================
// Create User Card
// ============================================

function CreateUserCard({
    queryClient: qc,
    toast,
}: {
    queryClient: ReturnType<typeof useQueryClient>;
    toast: ReturnType<typeof useToast>["toast"];
}) {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("user");
    const [durationPreset, setDurationPreset] = useState("30");
    const [customDays, setCustomDays] = useState("");

    const getDurationDays = () => {
        if (durationPreset === "custom") return parseInt(customDays) || 0;
        return parseInt(durationPreset) || 0;
    };

    const createMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/user_management.php?action=create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    username,
                    email: email || null,
                    display_name: displayName || null,
                    password,
                    role,
                    duration_days: getDurationDays(),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");
            return data;
        },
        onSuccess: () => {
            toast({ title: "Usuario creado", description: `Se creó el usuario "${username}" exitosamente.` });
            qc.invalidateQueries({ queryKey: ["/api/user_management"] });
            // Reset form
            setUsername("");
            setEmail("");
            setDisplayName("");
            setPassword("");
            setRole("user");
            setDurationPreset("30");
            setCustomDays("");
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-blue-600" />
                    Registrar Nuevo Usuario
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <Label className="text-xs">Nombre de usuario *</Label>
                        <Input
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="usuario123"
                        />
                    </div>
                    <div>
                        <Label className="text-xs">Nombre completo</Label>
                        <Input
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Juan Pérez"
                        />
                    </div>
                    <div>
                        <Label className="text-xs">Correo electrónico</Label>
                        <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="correo@ejemplo.com"
                        />
                    </div>
                    <div>
                        <Label className="text-xs">Contraseña * (mín. 4 caracteres)</Label>
                        <Input
                            type="text"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Contraseña"
                            minLength={4}
                        />
                    </div>
                    <div>
                        <Label className="text-xs">Rol</Label>
                        <Select value={role} onValueChange={setRole}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="user">Usuario</SelectItem>
                                <SelectItem value="admin">Administrador</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-xs">Duración de acceso</Label>
                        <Select value={durationPreset} onValueChange={setDurationPreset}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {DURATION_PRESETS.map((p) => (
                                    <SelectItem key={p.days} value={p.days.toString()}>
                                        {p.label}
                                    </SelectItem>
                                ))}
                                <SelectItem value="custom">Personalizado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {durationPreset === "custom" && (
                        <div>
                            <Label className="text-xs">Días personalizados</Label>
                            <Input
                                type="number"
                                min="1"
                                value={customDays}
                                onChange={(e) => setCustomDays(e.target.value)}
                                placeholder="Número de días"
                            />
                        </div>
                    )}
                </div>
                <div className="mt-4">
                    <Button
                        onClick={() => createMutation.mutate()}
                        disabled={!username || !password || password.length < 4 || createMutation.isPending}
                    >
                        {createMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <UserPlus className="h-4 w-4 mr-2" />
                        )}
                        Crear Usuario
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

// ============================================
// User Row with Actions
// ============================================

function getTimeColor(percent: number, status: string): string {
    if (status === 'expired' || status === 'disabled' || status === 'deleted') return 'text-gray-400';
    if (percent === null || percent === 100) return 'text-green-600'; // Permanent
    if (percent > 50) return 'text-green-600';
    if (percent > 10) return 'text-yellow-600';
    return 'text-red-600';
}

function getTimeBg(percent: number, status: string): string {
    if (status === 'expired' || status === 'disabled' || status === 'deleted') return 'bg-gray-100 dark:bg-gray-800';
    if (percent === null || percent === 100) return 'bg-green-50 dark:bg-green-950';
    if (percent > 50) return 'bg-green-50 dark:bg-green-950';
    if (percent > 10) return 'bg-yellow-50 dark:bg-yellow-950';
    return 'bg-red-50 dark:bg-red-950';
}

function getStatusBadge(status: string) {
    switch (status) {
        case 'active':
            return <Badge variant="default" className="bg-green-600">Activo</Badge>;
        case 'expired':
            return <Badge variant="destructive">Expirado</Badge>;
        case 'disabled':
            return <Badge variant="secondary" className="bg-gray-500 text-white">Desactivado</Badge>;
        case 'deleted':
            return <Badge variant="secondary" className="bg-gray-300 text-gray-600">Eliminado</Badge>;
        default:
            return <Badge variant="secondary">{status}</Badge>;
    }
}

function UserRow({
    user,
    queryClient: qc,
    toast,
}: {
    user: ManagedUser;
    queryClient: ReturnType<typeof useQueryClient>;
    toast: ReturnType<typeof useToast>["toast"];
}) {
    const timeColor = getTimeColor(user.time_remaining_percent, user.account_status);
    const timeBg = getTimeBg(user.time_remaining_percent, user.account_status);

    const toggleMutation = useMutation({
        mutationFn: async (newStatus: string) => {
            const res = await fetch(`/api/user_management.php?action=toggle_status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle_status', user_id: user.id, status: newStatus }),
            });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: (_data, status) => {
            toast({ title: status === 'active' ? "Cuenta reactivada" : "Cuenta desactivada", description: `${user.username}` });
            qc.invalidateQueries({ queryKey: ["/api/user_management"] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/user_management.php?action=delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', user_id: user.id }),
            });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Usuario eliminado", description: `Se eliminó "${user.username}"`, variant: "destructive" });
            qc.invalidateQueries({ queryKey: ["/api/user_management"] });
        },
    });

    const renewMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/user_management.php?action=renew`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'renew', user_id: user.id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");
            return data;
        },
        onSuccess: () => {
            toast({ title: "Acceso renovado", description: `Se renovó el acceso de "${user.username}" por ${user.access_duration_days} días` });
            qc.invalidateQueries({ queryKey: ["/api/user_management"] });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const isAdmin = user.role === 'admin';

    return (
        <TableRow className={user.account_status === 'deleted' ? 'opacity-50' : ''}>
            <TableCell>
                <div>
                    <div className="font-medium">{user.display_name || user.username}</div>
                    {user.display_name && <div className="text-xs text-muted-foreground">@{user.username}</div>}
                </div>
            </TableCell>
            <TableCell className="text-sm">{user.email || '-'}</TableCell>
            <TableCell>
                <Badge variant={isAdmin ? 'default' : 'secondary'}>
                    {isAdmin ? 'Admin' : 'Usuario'}
                </Badge>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
                {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
                {user.access_expires_at
                    ? new Date(user.access_expires_at).toLocaleDateString()
                    : 'Permanente'}
            </TableCell>
            <TableCell>
                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${timeBg} ${timeColor}`}>
                    <Timer className="h-3 w-3" />
                    {user.time_remaining_text}
                </div>
            </TableCell>
            <TableCell>{getStatusBadge(user.account_status)}</TableCell>
            <TableCell>
                {!isAdmin && (
                    <div className="flex items-center gap-1">
                        {/* Extend Access */}
                        <ExtendAccessDialog user={user} queryClient={qc} toast={toast} />

                        {/* Renew */}
                        {user.access_duration_days && user.access_duration_days > 0 && (
                            <Button
                                size="sm"
                                variant="ghost"
                                title="Renovar con misma duración"
                                onClick={() => renewMutation.mutate()}
                                disabled={renewMutation.isPending}
                            >
                                {renewMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                            </Button>
                        )}

                        {/* Toggle Status */}
                        {user.account_status === 'active' ? (
                            <Button
                                size="sm"
                                variant="ghost"
                                title="Desactivar"
                                onClick={() => toggleMutation.mutate('disabled')}
                                disabled={toggleMutation.isPending}
                            >
                                <UserX className="h-3 w-3 text-orange-500" />
                            </Button>
                        ) : user.account_status !== 'deleted' ? (
                            <Button
                                size="sm"
                                variant="ghost"
                                title="Reactivar"
                                onClick={() => toggleMutation.mutate('active')}
                                disabled={toggleMutation.isPending}
                            >
                                <UserCheck className="h-3 w-3 text-green-500" />
                            </Button>
                        ) : null}

                        {/* Delete */}
                        {user.account_status !== 'deleted' && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="ghost" title="Eliminar">
                                        <Trash2 className="h-3 w-3 text-red-500" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta acción desactivará la cuenta de <strong>{user.username}</strong>.
                                            El usuario no podrá iniciar sesión.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => deleteMutation.mutate()}
                                            className="bg-red-600 hover:bg-red-700"
                                        >
                                            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                )}
            </TableCell>
        </TableRow>
    );
}

// ============================================
// Extend Access Dialog
// ============================================

function ExtendAccessDialog({
    user,
    queryClient: qc,
    toast,
}: {
    user: ManagedUser;
    queryClient: ReturnType<typeof useQueryClient>;
    toast: ReturnType<typeof useToast>["toast"];
}) {
    const [open, setOpen] = useState(false);
    const [durationPreset, setDurationPreset] = useState("30");
    const [customDays, setCustomDays] = useState("");
    const [fromNow, setFromNow] = useState(true);

    const getDurationDays = () => {
        if (durationPreset === "custom") return parseInt(customDays) || 0;
        return parseInt(durationPreset) || 0;
    };

    const extendMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/user_management.php?action=extend_access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'extend_access',
                    user_id: user.id,
                    duration_days: getDurationDays(),
                    from_now: fromNow,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");
            return data;
        },
        onSuccess: () => {
            toast({ title: "Acceso actualizado", description: `Se modificó el acceso de "${user.username}"` });
            qc.invalidateQueries({ queryKey: ["/api/user_management"] });
            setOpen(false);
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="ghost" title="Modificar acceso">
                    <Clock className="h-3 w-3 text-blue-500" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Modificar Acceso — {user.username}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="bg-muted p-3 rounded text-sm">
                        <p>Estado actual: <strong>{user.account_status}</strong></p>
                        <p>Tiempo restante: <strong>{user.time_remaining_text}</strong></p>
                        {user.access_expires_at && (
                            <p>Expira: <strong>{new Date(user.access_expires_at).toLocaleString()}</strong></p>
                        )}
                    </div>

                    <div>
                        <Label>Nueva duración</Label>
                        <Select value={durationPreset} onValueChange={setDurationPreset}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {DURATION_PRESETS.map((p) => (
                                    <SelectItem key={p.days} value={p.days.toString()}>
                                        {p.label}
                                    </SelectItem>
                                ))}
                                <SelectItem value="custom">Personalizado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {durationPreset === "custom" && (
                        <div>
                            <Label>Días personalizados</Label>
                            <Input
                                type="number"
                                min="1"
                                value={customDays}
                                onChange={(e) => setCustomDays(e.target.value)}
                                placeholder="Número de días"
                            />
                        </div>
                    )}

                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                checked={fromNow}
                                onChange={() => setFromNow(true)}
                            />
                            <span className="text-sm">Desde ahora</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                checked={!fromNow}
                                onChange={() => setFromNow(false)}
                            />
                            <span className="text-sm">Extender desde expiración actual</span>
                        </label>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button
                        onClick={() => extendMutation.mutate()}
                        disabled={extendMutation.isPending}
                    >
                        {extendMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Clock className="h-4 w-4 mr-2" />
                        )}
                        Aplicar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
