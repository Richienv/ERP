"use client";

import { CheckCircle, Download, FileText, Filter, Plus, Search, Truck } from "lucide-react";
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

const VENDOR_PAYMENTS = [
    { id: "VPAY-001", bill: "BILL-002", vendor: "CV. Mesin Jahit Jaya", amount: 45000000, date: "16 Jan 2026", method: "Transfer Mandiri" },
    { id: "VPAY-002", bill: "BILL-005", vendor: "PT. Benang Nusantara", amount: 5000000, date: "12 Jan 2026", method: "Cek Giro" },
];

export default function VendorPaymentsPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Pembayaran Keluar</h2>
                    <p className="text-muted-foreground">Catat pembayaran kepada vendor dan supplier.</p>
                </div>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Bayar Tagihan
                </Button>
            </div>

            {/* Metrics */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Dibayar (Bulan Ini)</CardTitle>
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Rp 50.000.000</div>
                        <p className="text-xs text-muted-foreground">+15% dari bulan lalu</p>
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
                                <TableHead>No. Bill</TableHead>
                                <TableHead>Vendor</TableHead>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Metode</TableHead>
                                <TableHead className="text-right">Jumlah</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {VENDOR_PAYMENTS.map((pay) => (
                                <TableRow key={pay.id}>
                                    <TableCell className="font-medium">{pay.id}</TableCell>
                                    <TableCell>{pay.bill}</TableCell>
                                    <TableCell>{pay.vendor}</TableCell>
                                    <TableCell>{pay.date}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{pay.method}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-rose-600">
                                        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(pay.amount)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm">Bukti Bayar</Button>
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
