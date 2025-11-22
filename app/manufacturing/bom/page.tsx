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
import {
    Plus,
    Search,
    Filter,
    MoreHorizontal,
    Layers,
    FileCode,
    History,
    Settings
} from "lucide-react";
import Link from "next/link";
import { mockBOMs } from "@/components/manufacturing/bom/data";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function BomPage() {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Bill of Materials (BoM)</h2>
                    <p className="text-muted-foreground">
                        Kelola struktur produk, resep, dan komponen material.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button asChild>
                        <Link href="/manufacturing/bom/new">
                            <Plus className="mr-2 h-4 w-4" />
                            Buat BoM Baru
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total BoM Aktif</CardTitle>
                        <Layers className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{mockBOMs.filter(b => b.status === 'ACTIVE').length}</div>
                        <p className="text-xs text-muted-foreground">
                            Siap untuk produksi
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">BoM Draft</CardTitle>
                        <FileCode className="h-4 w-4 text-yellow-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">
                            {mockBOMs.filter(b => b.status === 'DRAFT').length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Sedang dalam penyusunan
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Revisi Terakhir</CardTitle>
                        <History className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">2 Hari Lalu</div>
                        <p className="text-xs text-muted-foreground">
                            Update pada BOM-CHAIR-001
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters & Search */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className="relative w-[300px]">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Cari kode BoM atau nama produk..." className="pl-8" />
                    </div>
                    <Button variant="outline" size="icon">
                        <Filter className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Data Table */}
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[150px]">Kode BoM</TableHead>
                            <TableHead>Produk</TableHead>
                            <TableHead className="w-[100px]">Versi</TableHead>
                            <TableHead className="w-[120px]">Status</TableHead>
                            <TableHead className="text-right">Estimasi Biaya</TableHead>
                            <TableHead className="w-[150px]">Terakhir Update</TableHead>
                            <TableHead className="text-right w-[80px]">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockBOMs.map((bom) => (
                            <TableRow key={bom.id}>
                                <TableCell className="font-medium">{bom.code}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{bom.productName}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {bom.productCode}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">{bom.version}</Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={bom.status === 'ACTIVE' ? 'default' : bom.status === 'OBSOLETE' ? 'secondary' : 'outline'}
                                        className={
                                            bom.status === 'ACTIVE' ? 'bg-green-100 text-green-700 hover:bg-green-100 border-green-200' :
                                                bom.status === 'OBSOLETE' ? 'bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200' :
                                                    'bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200'
                                        }
                                    >
                                        {bom.status === 'ACTIVE' ? 'Aktif' : bom.status === 'OBSOLETE' ? 'Usang' : 'Draft'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {formatCurrency(bom.totalCost)}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    {bom.updatedAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                                            <DropdownMenuItem>Edit Struktur</DropdownMenuItem>
                                            <DropdownMenuItem>Duplikat (Versi Baru)</DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-red-600">Arsipkan</DropdownMenuItem>
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
