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
    FileText,
    Tags,
    Calendar,
    ArrowUpDown
} from "lucide-react";
import Link from "next/link";
import { mockPriceLists } from "@/components/sales/pricelists/data";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function PriceListsPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Daftar Harga</h2>
                    <p className="text-muted-foreground">
                        Kelola daftar harga produk untuk berbagai tipe pelanggan.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button asChild>
                        <Link href="/sales/pricelists/new">
                            <Plus className="mr-2 h-4 w-4" />
                            Buat Daftar Harga
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Daftar Harga</CardTitle>
                        <Tags className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{mockPriceLists.length}</div>
                        <p className="text-xs text-muted-foreground">
                            {mockPriceLists.filter(p => p.status === 'ACTIVE').length} aktif digunakan
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Item Produk</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {mockPriceLists.reduce((acc, curr) => acc + curr.itemCount, 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Tersebar di semua daftar harga
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Promo Aktif</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {mockPriceLists.filter(p => p.code.includes("PROMO") && p.status === 'ACTIVE').length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Daftar harga promo berjalan
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters & Search */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className="relative w-[300px]">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Cari daftar harga..." className="pl-8" />
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
                            <TableHead className="w-[150px]">Kode</TableHead>
                            <TableHead>Nama Daftar Harga</TableHead>
                            <TableHead>Mata Uang</TableHead>
                            <TableHead>Jumlah Item</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Terakhir Update</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockPriceLists.map((list) => (
                            <TableRow key={list.id}>
                                <TableCell className="font-medium">{list.code}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{list.name}</span>
                                        <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                                            {list.description}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>{list.currency}</TableCell>
                                <TableCell>{list.itemCount} item</TableCell>
                                <TableCell>
                                    <Badge
                                        variant={list.status === 'ACTIVE' ? 'default' : list.status === 'INACTIVE' ? 'secondary' : 'outline'}
                                        className={
                                            list.status === 'ACTIVE' ? 'bg-green-100 text-green-700 hover:bg-green-100 border-green-200' :
                                                list.status === 'INACTIVE' ? 'bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200' :
                                                    'bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200'
                                        }
                                    >
                                        {list.status === 'ACTIVE' ? 'Aktif' : list.status === 'INACTIVE' ? 'Tidak Aktif' : 'Draft'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {list.lastUpdated.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                                            <DropdownMenuItem>Edit</DropdownMenuItem>
                                            <DropdownMenuItem>Duplikat</DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-red-600">Hapus</DropdownMenuItem>
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
