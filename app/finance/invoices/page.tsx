"use client";

import { FileText, Plus, Search, Filter, Download, Mail, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

const INVOICES = [
    { id: "INV-001", customer: "PT. Garment Indah Jaya", amount: 45000000, date: "08 Jan 2026", dueDate: "22 Jan 2026", status: "Belum Dibayar" },
    { id: "INV-002", customer: "CV. Tekstil Makmur", amount: 32000000, date: "05 Jan 2026", dueDate: "19 Jan 2026", status: "Lunas" },
    { id: "INV-003", customer: "Boutique Fashion A", amount: 15600000, date: "02 Jan 2026", dueDate: "16 Jan 2026", status: "Terlambat" },
    { id: "INV-004", customer: "UD. Kain Sejahtera", amount: 23000000, date: "28 Des 2025", dueDate: "11 Jan 2026", status: "Lunas" },
    { id: "INV-005", customer: "PT. Mode Nusantara", amount: 56000000, date: "20 Des 2025", dueDate: "03 Jan 2026", status: "Lunas" },
];

export default function InvoicingPage() {
    const formatRupiah = (num: number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num);
    };

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Invoicing & Piutang</h2>
                    <p className="text-muted-foreground">Kelola tagihan pelanggan, pembayaran, dan piutang usaha.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" /> Import dari SO
                    </Button>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Buat Invoice Baru
                    </Button>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Tagihan Belum Dibayar</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">Rp 45.000.000</div>
                        <p className="text-xs text-muted-foreground">3 Invoice pending</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Jatuh Tempo (Overdue)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-rose-600">Rp 15.600.000</div>
                        <p className="text-xs text-muted-foreground">1 Invoice terlambat</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Pembayaran Diterima (Bulan Ini)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">Rp 111.000.000</div>
                        <p className="text-xs text-muted-foreground">+12% dari bulan lalu</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filter & Search */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center flex-1 gap-2 max-w-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Cari invoice, pelanggan..." className="pl-9" />
                    </div>
                    <Button variant="outline" size="icon">
                        <Filter className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                </div>
            </div>

            {/* Invoice Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Invoice #</TableHead>
                                <TableHead>Pelanggan</TableHead>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Jatuh Tempo</TableHead>
                                <TableHead className="text-right">Jumlah</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {INVOICES.map((invoice) => (
                                <TableRow key={invoice.id}>
                                    <TableCell className="font-medium">{invoice.id}</TableCell>
                                    <TableCell>{invoice.customer}</TableCell>
                                    <TableCell>{invoice.date}</TableCell>
                                    <TableCell>{invoice.dueDate}</TableCell>
                                    <TableCell className="text-right font-bold">{formatRupiah(invoice.amount)}</TableCell>
                                    <TableCell>
                                        <Badge variant={
                                            invoice.status === "Lunas" ? "default" :
                                                invoice.status === "Terlambat" ? "destructive" :
                                                    "secondary"
                                        } className={
                                            invoice.status === "Lunas" ? "bg-emerald-500 hover:bg-emerald-600" : ""
                                        }>
                                            {invoice.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                                <DropdownMenuItem>
                                                    <FileText className="mr-2 h-4 w-4" /> Lihat Detail
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                    <Mail className="mr-2 h-4 w-4" /> Kirim Email
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-emerald-600">
                                                    Tandai Lunas
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
        </div>
    );
}
