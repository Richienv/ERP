"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Users,
    UserPlus,
    Search,
    Filter,
    MoreHorizontal,
    Mail,
    Phone,
    Shield,
    UserCheck,
    UserX,
    Clock
} from "lucide-react";
import { mockUsers, rolePermissions, departments } from "@/components/settings/users/data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function UserManagementPage() {
    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'ADMIN': return 'bg-red-100 text-red-700 border-red-200';
            case 'MANAGER': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'STAFF': return 'bg-green-100 text-green-700 border-green-200';
            case 'VIEWER': return 'bg-gray-100 text-gray-700 border-gray-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'bg-green-100 text-green-700 border-green-200';
            case 'INACTIVE': return 'bg-gray-100 text-gray-700 border-gray-200';
            case 'SUSPENDED': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const activeUsers = mockUsers.filter(u => u.status === 'ACTIVE').length;
    const adminUsers = mockUsers.filter(u => u.role === 'ADMIN').length;
    const recentLogins = mockUsers.filter(u => {
        const dayAgo = new Date();
        dayAgo.setDate(dayAgo.getDate() - 1);
        return u.lastLogin > dayAgo;
    }).length;

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Manajemen Pengguna</h2>
                    <p className="text-muted-foreground">
                        Kelola akun pengguna, role, dan izin akses sistem.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Tambah Pengguna
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Pengguna</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{mockUsers.length}</div>
                        <p className="text-xs text-muted-foreground">
                            Terdaftar di sistem
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pengguna Aktif</CardTitle>
                        <UserCheck className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{activeUsers}</div>
                        <p className="text-xs text-muted-foreground">
                            Status aktif
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Administrator</CardTitle>
                        <Shield className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{adminUsers}</div>
                        <p className="text-xs text-muted-foreground">
                            Full access
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Login 24 Jam</CardTitle>
                        <Clock className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{recentLogins}</div>
                        <p className="text-xs text-muted-foreground">
                            Aktivitas terbaru
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters and Search */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Daftar Pengguna</CardTitle>
                            <CardDescription>Kelola dan pantau akun pengguna sistem.</CardDescription>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="relative w-[250px]">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Cari nama atau email..." className="pl-8 h-9" />
                            </div>
                            <Select defaultValue="all">
                                <SelectTrigger className="w-[150px] h-9">
                                    <SelectValue placeholder="Role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Role</SelectItem>
                                    <SelectItem value="ADMIN">Admin</SelectItem>
                                    <SelectItem value="MANAGER">Manager</SelectItem>
                                    <SelectItem value="STAFF">Staff</SelectItem>
                                    <SelectItem value="VIEWER">Viewer</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select defaultValue="all">
                                <SelectTrigger className="w-[150px] h-9">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Status</SelectItem>
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Pengguna</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Departemen</TableHead>
                                <TableHead>Kontak</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Login Terakhir</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockUsers.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="flex items-center space-x-3">
                                            <Avatar>
                                                <AvatarFallback className="bg-primary text-primary-foreground">
                                                    {getInitials(user.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="font-medium">{user.name}</div>
                                                <div className="text-xs text-muted-foreground">{user.email}</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={getRoleBadgeColor(user.role)}>
                                            {user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{user.department}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col space-y-1 text-xs text-muted-foreground">
                                            <div className="flex items-center">
                                                <Mail className="mr-1 h-3 w-3" />
                                                {user.email}
                                            </div>
                                            {user.phoneNumber && (
                                                <div className="flex items-center">
                                                    <Phone className="mr-1 h-3 w-3" />
                                                    {user.phoneNumber}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={getStatusBadgeColor(user.status)}>
                                            {user.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {user.lastLogin.toLocaleDateString('id-ID', {
                                            day: 'numeric',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                                <DropdownMenuItem>
                                                    <Shield className="mr-2 h-4 w-4" />
                                                    Edit Role
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                    <Mail className="mr-2 h-4 w-4" />
                                                    Kirim Email
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>Reset Password</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                {user.status === 'ACTIVE' ? (
                                                    <DropdownMenuItem className="text-orange-600">
                                                        <UserX className="mr-2 h-4 w-4" />
                                                        Nonaktifkan
                                                    </DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem className="text-green-600">
                                                        <UserCheck className="mr-2 h-4 w-4" />
                                                        Aktifkan
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem className="text-red-600">
                                                    Hapus Pengguna
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Role Permissions Info */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Shield className="mr-2 h-5 w-5" />
                            Role & Permissions
                        </CardTitle>
                        <CardDescription>
                            Izin akses untuk setiap role pengguna
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {Object.entries(rolePermissions).map(([role, permissions]) => (
                            <div key={role} className="border-b pb-4 last:border-0 last:pb-0">
                                <Badge variant="outline" className={`${getRoleBadgeColor(role)} mb-2`}>
                                    {role}
                                </Badge>
                                <ul className="space-y-1 text-sm text-muted-foreground mt-2">
                                    {permissions.map((perm, idx) => (
                                        <li key={idx} className="flex items-center">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2" />
                                            {perm}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Distribusi Departemen</CardTitle>
                        <CardDescription>
                            Jumlah pengguna per departemen
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {departments.map((dept) => {
                            const count = mockUsers.filter(u => u.department === dept).length;
                            return (
                                <div key={dept} className="flex items-center justify-between">
                                    <span className="text-sm font-medium">{dept}</span>
                                    <div className="flex items-center space-x-2">
                                        <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary rounded-full"
                                                style={{ width: `${(count / mockUsers.length) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-sm text-muted-foreground w-8 text-right">{count}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
