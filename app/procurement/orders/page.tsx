"use client"

import { useState } from "react"
import {
    Search,
    Plus,
    Filter,
    MoreVertical,
    ArrowRight,
    FileCheck,
    Truck,
    AlertCircle,
    Calendar,
    Download
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"

// Mock Orders Data
const orders = [
    { id: "PO-2024-001", vendor: "PT Textile Sejahtera", date: "2024-01-10", total: "Rp 45.000.000", status: "Draft", items: 5, eta: "-" },
    { id: "PO-2024-002", vendor: "Zhejiang Fabrics Ltd", date: "2024-01-08", total: "Rp 128.500.000", status: "Sent", items: 12, eta: "2024-01-25" },
    { id: "PO-2024-003", vendor: "Global Chemical Indo", date: "2024-01-05", total: "Rp 12.000.000", status: "Approved", items: 3, eta: "2024-01-12" },
    { id: "PO-2024-004", vendor: "CV Benang Emas", date: "2024-01-02", total: "Rp 8.500.000", status: "Received", items: 8, eta: "Received" },
    { id: "PO-2024-005", vendor: "Mitra Pack", date: "2023-12-28", total: "Rp 5.200.000", status: "Received", items: 20, eta: "Received" },
]

export default function PurchaseOrdersPage() {
    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight text-black flex items-center gap-2">
                        Pesanan Pembelian (PO)
                    </h2>
                    <p className="text-muted-foreground mt-1 font-medium">Lacak status pesanan dan pengiriman masuk.</p>
                </div>
                <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide transition-all active:translate-y-1 active:shadow-none">
                    <Plus className="mr-2 h-4 w-4" /> Buat PO
                </Button>
            </div>

            {/* Tabs & Filters */}
            <Tabs defaultValue="all" className="w-full">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                    <TabsList className="bg-zinc-100 border border-black p-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <TabsTrigger value="all" className="data-[state=active]:bg-black data-[state=active]:text-white font-bold uppercase text-xs">All Orders</TabsTrigger>
                        <TabsTrigger value="active" className="data-[state=active]:bg-black data-[state=active]:text-white font-bold uppercase text-xs">Active</TabsTrigger>
                        <TabsTrigger value="completed" className="data-[state=active]:bg-black data-[state=active]:text-white font-bold uppercase text-xs">Completed</TabsTrigger>
                    </TabsList>

                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-[300px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Cari No. PO atau Vendor..." className="pl-9 border-black focus-visible:ring-black font-medium" />
                        </div>
                        <Button variant="outline" size="icon" className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none hover:bg-zinc-100">
                            <Filter className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <TabsContent value="all" className="mt-0">
                    <Card className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-b border-black bg-zinc-100/50">
                                    <TableHead className="font-bold text-black uppercase text-xs">PO Number</TableHead>
                                    <TableHead className="font-bold text-black uppercase text-xs">Vendor</TableHead>
                                    <TableHead className="font-bold text-black uppercase text-xs">Date</TableHead>
                                    <TableHead className="font-bold text-black uppercase text-xs">Status</TableHead>
                                    <TableHead className="text-right font-bold text-black uppercase text-xs">Total</TableHead>
                                    <TableHead className="text-right font-bold text-black uppercase text-xs">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map((po) => (
                                    <TableRow key={po.id} className="cursor-pointer hover:bg-zinc-50 border-b border-black/5 last:border-0 group">
                                        <TableCell className="font-mono font-bold">{po.id}</TableCell>
                                        <TableCell className="font-medium">{po.vendor}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Calendar className="h-3 w-3" /> {po.date}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={`
                                                border-black font-bold uppercase text-[10px] shadow-sm 
                                                ${po.status === 'Received' ? 'bg-zinc-100 text-zinc-600' :
                                                        po.status === 'Sent' ? 'bg-blue-100 text-blue-700' :
                                                            po.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                                                'bg-amber-50 text-amber-700'}
                                            `}
                                            >
                                                {po.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-black">{po.total}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-black hover:text-white rounded-full">
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-black hover:text-white rounded-full">
                                                    <ArrowRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
            </Tabs>

        </div>
    )
}
