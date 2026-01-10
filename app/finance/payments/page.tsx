"use client";

import { CheckCircle, Download, FileText, Filter, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const PAYMENTS = [
    { id: "PAY-001", invoice: "INV-002", customer: "CV. Tekstil Makmur", amount: 32000000, date: "15 Jan 2026", method: "Transfer BCA" },
    { id: "PAY-002", invoice: "INV-004", customer: "UD. Kain Sejahtera", amount: 23000000, date: "10 Jan 2026", method: "Transfer Mandiri" },
];

export default function PaymentsPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Penerimaan Pembayaran</h2>
                    <p className="text-muted-foreground">Catat dan kelola pembayaran masuk dari pelanggan.</p>
                </div>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Terima Pembayaran Baru
                </Button>
            </div>

            {/* Metrics */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Diterima (Bulan Ini)</CardTitle>
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Rp 55.000.000</div>
                        <p className="text-xs text-muted-foreground">+8% dari bulan lalu</p>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>No. Pembayaran</TableHead>
                                <TableHead>No. Invoice</TableHead>
                                <TableHead>Pelanggan</TableHead>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Metode</TableHead>
                                <TableHead className="text-right">Jumlah</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {PAYMENTS.map((pay) => (
                                <TableRow key={pay.id}>
                                    <TableCell className="font-medium">{pay.id}</TableCell>
                                    <TableCell>{pay.invoice}</TableCell>
                                    <TableCell>{pay.customer}</TableCell>
                                    <TableCell>{pay.date}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{pay.method}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-emerald-600">
                                        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(pay.amount)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm">Detail</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
