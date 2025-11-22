"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Plus,
    Search,
    Filter,
    MoreHorizontal,
    Factory,
    Clock,
    CheckCircle2,
    AlertCircle
} from "lucide-react";
import Link from "next/link";
import { mockManufacturingOrders } from "@/components/manufacturing/orders/data";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function ManufacturingOrdersPage() {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'DONE': return 'bg-green-100 text-green-700 border-green-200';
            case 'IN_PROGRESS': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'CONFIRMED': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'PLANNED': return 'bg-slate-100 text-slate-700 border-slate-200';
            case 'CANCELLED': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'HIGH': return 'text-red-600 bg-red-50 border-red-100';
            case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 border-yellow-100';
            case 'LOW': return 'text-blue-600 bg-blue-50 border-blue-100';
            default: return 'text-gray-600';
        }
    };

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Order Produksi (MO)</h2>
                    <p className="text-muted-foreground">
                        Kelola jadwal dan pelaksanaan produksi barang.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button asChild>
                        <Link href="/manufacturing/orders/new">
                            <Plus className="mr-2 h-4 w-4" />
                            Buat Order Baru
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Order Aktif</CardTitle>
                        <Factory className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {mockManufacturingOrders.filter(mo => ['IN_PROGRESS', 'CONFIRMED'].includes(mo.status)).length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Sedang berjalan di lantai produksi
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Terjadwal</CardTitle>
                        <Clock className="h-4 w-4 text-slate-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-600">
                            {mockManufacturingOrders.filter(mo => mo.status === 'PLANNED').length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Menunggu konfirmasi material
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Selesai Bulan Ini</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {mockManufacturingOrders.filter(mo => mo.status === 'DONE').length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            On-time delivery 98%
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Prioritas Tinggi</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {mockManufacturingOrders.filter(mo => mo.priority === 'HIGH' && mo.status !== 'DONE').length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Butuh perhatian segera
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters & Search */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className="relative w-[300px]">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Cari No. MO atau nama produk..." className="pl-8" />
                    </div>
                    <Button variant="outline" size="icon">
                        <Filter className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex items-center space-x-2">
                    <Input type="date" className="w-[150px]" />
                </div>
            </div>

            {/* Data Table */}
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[140px]">No. Order</TableHead>
                            <TableHead>Produk</TableHead>
                            <TableHead className="w-[100px]">Jumlah</TableHead>
                            <TableHead className="w-[150px]">Deadline</TableHead>
                            <TableHead className="w-[120px]">Status</TableHead>
                            <TableHead className="w-[150px]">Progress</TableHead>
                            <TableHead className="w-[100px]">Prioritas</TableHead>
                            <TableHead className="text-right w-[80px]">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockManufacturingOrders.map((mo) => (
                            <TableRow key={mo.id}>
                                <TableCell className="font-medium">{mo.moNumber}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{mo.productName}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {mo.productCode}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {mo.quantity} {mo.uom}
                                </TableCell>
                                <TableCell>
                                    {mo.deadline.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant="outline"
                                        className={getStatusColor(mo.status)}
                                    >
                                        {mo.status.replace('_', ' ')}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Progress value={mo.progress} className="h-2" />
                                        <span className="text-xs text-muted-foreground w-[30px]">{mo.progress}%</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={getPriorityColor(mo.priority)}>
                                        {mo.priority}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">Menu</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                            <DropdownMenuItem>Lihat Detail</DropdownMenuItem>
                                            <DropdownMenuItem>Update Progress</DropdownMenuItem>
                                            <DropdownMenuItem>Cek Ketersediaan Material</DropdownMenuItem>
                                            {mo.status === 'PLANNED' && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem>Konfirmasi Order</DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
