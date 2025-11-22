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
    Calendar,
    ArrowUpDown,
    Download
} from "lucide-react";
import Link from "next/link";
import { mockJournalEntries } from "@/components/finance/journal/data";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function JournalPage() {
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
                    <h2 className="text-3xl font-bold tracking-tight">Jurnal Umum</h2>
                    <p className="text-muted-foreground">
                        Catatan transaksi keuangan harian perusahaan.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Ekspor
                    </Button>
                    <Button asChild>
                        <Link href="/finance/journal/new">
                            <Plus className="mr-2 h-4 w-4" />
                            Entri Jurnal Baru
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Transaksi Bulan Ini</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{mockJournalEntries.length}</div>
                        <p className="text-xs text-muted-foreground">
                            +12% dari bulan lalu
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Debit</CardTitle>
                        <ArrowUpDown className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(mockJournalEntries.reduce((acc, curr) => acc + curr.totalAmount, 0))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Total mutasi debit periode ini
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Status Posting</CardTitle>
                        <Calendar className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {mockJournalEntries.filter(j => j.status === 'POSTED').length} / {mockJournalEntries.length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Transaksi telah diposting
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters & Search */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className="relative w-[300px]">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Cari no. referensi atau deskripsi..." className="pl-8" />
                    </div>
                    <Button variant="outline" size="icon">
                        <Filter className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex items-center space-x-2">
                    <Input type="date" className="w-[150px]" />
                    <span>-</span>
                    <Input type="date" className="w-[150px]" />
                </div>
            </div>

            {/* Data Table */}
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px]">Tanggal</TableHead>
                            <TableHead className="w-[150px]">No. Referensi</TableHead>
                            <TableHead>Deskripsi</TableHead>
                            <TableHead className="text-right">Total Nilai</TableHead>
                            <TableHead className="w-[100px]">Status</TableHead>
                            <TableHead className="w-[150px]">Dibuat Oleh</TableHead>
                            <TableHead className="text-right w-[80px]">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockJournalEntries.map((entry) => (
                            <TableRow key={entry.id}>
                                <TableCell>
                                    {entry.transactionDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </TableCell>
                                <TableCell className="font-medium">{entry.referenceNumber}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{entry.description}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {entry.lines.length} baris jurnal
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {formatCurrency(entry.totalAmount)}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={entry.status === 'POSTED' ? 'default' : entry.status === 'VOID' ? 'destructive' : 'outline'}
                                        className={
                                            entry.status === 'POSTED' ? 'bg-green-100 text-green-700 hover:bg-green-100 border-green-200' :
                                                entry.status === 'VOID' ? 'bg-red-100 text-red-700 hover:bg-red-100 border-red-200' :
                                                    'bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200'
                                        }
                                    >
                                        {entry.status === 'POSTED' ? 'Posted' : entry.status === 'VOID' ? 'Void' : 'Draft'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    {entry.createdBy}
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
                                            <DropdownMenuItem>Cetak Voucher</DropdownMenuItem>
                                            {entry.status === 'DRAFT' && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem>Edit</DropdownMenuItem>
                                                    <DropdownMenuItem>Posting</DropdownMenuItem>
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
