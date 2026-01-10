"use client";

import { AlertCircle, CheckCircle, Download, FileText, Filter, Plus, Search, Truck } from "lucide-react";
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

const BILLS = [
    { id: "BILL-001", vendor: "PT. Benang Nusantara", amount: 15000000, date: "10 Jan 2026", dueDate: "24 Jan 2026", status: "Belum Dibayar" },
    { id: "BILL-002", vendor: "CV. Mesin Jahit Jaya", amount: 45000000, date: "05 Jan 2026", dueDate: "19 Jan 2026", status: "Lunas" },
    { id: "BILL-003", vendor: "Logistik Cepat", amount: 2500000, date: "02 Jan 2026", dueDate: "09 Jan 2026", status: "Terlambat" },
];

export default function VendorBillsPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Tagihan Pemasok (Bills)</h2>
                    <p className="text-muted-foreground">Kelola utang usaha dan tagihan dari vendor.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <Truck className="mr-2 h-4 w-4" /> Import dari Penerimaan
                    </Button>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Catat Bill Baru
                    </Button>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Utang Jatuh Tempo</CardTitle>
                        <AlertCircle className="h-4 w-4 text-rose-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-rose-600">Rp 2.500.000</div>
                        <p className="text-xs text-muted-foreground">1 Bill perlu perhatian</p>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>No. Bill</TableHead>
                                <TableHead>Vendor</TableHead>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Jatuh Tempo</TableHead>
                                <TableHead className="text-right">Jumlah</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {BILLS.map((bill) => (
                                <TableRow key={bill.id}>
                                    <TableCell className="font-medium">{bill.id}</TableCell>
                                    <TableCell>{bill.vendor}</TableCell>
                                    <TableCell>{bill.date}</TableCell>
                                    <TableCell>{bill.dueDate}</TableCell>
                                    <TableCell className="text-right font-bold">
                                        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(bill.amount)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={
                                            bill.status === "Lunas" ? "secondary" :
                                                bill.status === "Terlambat" ? "destructive" : "outline"
                                        } className={bill.status === "Lunas" ? "bg-emerald-100 text-emerald-700" : ""}>
                                            {bill.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm">Bayar</Button>
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
