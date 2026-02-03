"use client"

import { useState } from "react"
import {
    Search,
    Package,
    CheckCircle2,
    XCircle,
    Truck,
    ClipboardCheck,
    Calendar,
    FileText,
    Filter
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { formatIDR } from "@/lib/utils"
import { CreateGRNDialog } from "@/components/procurement/create-grn-dialog"
import { GRNDetailsSheet } from "@/components/procurement/grn-details-sheet"

interface POItem {
    id: string
    productId: string
    productName: string
    productCode: string
    unit: string
    orderedQty: number
    receivedQty: number
    remainingQty: number
    unitPrice: number
}

interface PendingPO {
    id: string
    number: string
    vendorName: string
    vendorId: string
    orderDate: Date
    expectedDate: Date | null
    status: string
    totalAmount: number
    items: POItem[]
    hasRemainingItems: boolean
}

interface GRNItem {
    id: string
    productName: string
    productCode: string
    quantityOrdered: number
    quantityReceived: number
    quantityAccepted: number
    quantityRejected: number
    unitCost: number
    inspectionNotes: string | null
}

interface GRN {
    id: string
    number: string
    poNumber: string
    vendorName: string
    warehouseName: string
    receivedBy: string
    receivedDate: Date
    status: string
    notes: string | null
    itemCount: number
    totalAccepted: number
    totalRejected: number
    items: GRNItem[]
}

interface Warehouse {
    id: string
    name: string
    code: string
}

interface Employee {
    id: string
    name: string
    department: string
}

interface ReceivingViewProps {
    pendingPOs: PendingPO[]
    grns: GRN[]
    warehouses: Warehouse[]
    employees: Employee[]
}

export function ReceivingView({ pendingPOs, grns, warehouses, employees }: ReceivingViewProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedGRN, setSelectedGRN] = useState<GRN | null>(null)

    const filteredPOs = pendingPOs.filter(po =>
        po.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const filteredGRNs = grns.filter(grn =>
        grn.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grn.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grn.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const draftGRNs = filteredGRNs.filter(g => g.status === 'DRAFT')
    const acceptedGRNs = filteredGRNs.filter(g => g.status === 'ACCEPTED')

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'ACCEPTED':
                return 'bg-emerald-100 text-emerald-700 border-emerald-200'
            case 'DRAFT':
                return 'bg-amber-100 text-amber-700 border-amber-200'
            case 'INSPECTING':
                return 'bg-blue-100 text-blue-700 border-blue-200'
            case 'REJECTED':
                return 'bg-red-100 text-red-700 border-red-200'
            default:
                return 'bg-zinc-100 text-zinc-600 border-zinc-200'
        }
    }

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight text-black flex items-center gap-2">
                        <ClipboardCheck className="h-8 w-8" /> Penerimaan Barang (GRN)
                    </h2>
                    <p className="text-muted-foreground mt-1 font-medium">
                        Terima dan verifikasi barang masuk dari supplier.
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-black uppercase text-muted-foreground">
                            PO Menunggu
                        </CardTitle>
                        <Truck className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{pendingPOs.length}</div>
                        <p className="text-xs text-muted-foreground">Ready to receive</p>
                    </CardContent>
                </Card>

                <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-black uppercase text-muted-foreground">
                            GRN Draft
                        </CardTitle>
                        <FileText className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{draftGRNs.length}</div>
                        <p className="text-xs text-muted-foreground">Pending acceptance</p>
                    </CardContent>
                </Card>

                <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-black uppercase text-muted-foreground">
                            Diterima Bulan Ini
                        </CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{acceptedGRNs.length}</div>
                        <p className="text-xs text-muted-foreground">GRNs completed</p>
                    </CardContent>
                </Card>

                <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-black uppercase text-muted-foreground">
                            Total Item Diterima
                        </CardTitle>
                        <Package className="h-4 w-4 text-indigo-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">
                            {acceptedGRNs.reduce((sum, g) => sum + g.totalAccepted, 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Units this month</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="pending" className="w-full">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                    <TabsList className="bg-zinc-100 border border-black p-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <TabsTrigger value="pending" className="data-[state=active]:bg-black data-[state=active]:text-white font-bold uppercase text-xs">
                            PO Menunggu <span className="ml-2 bg-white/20 px-1.5 rounded-full text-[10px]">{filteredPOs.length}</span>
                        </TabsTrigger>
                        <TabsTrigger value="grns" className="data-[state=active]:bg-black data-[state=active]:text-white font-bold uppercase text-xs">
                            Riwayat GRN <span className="ml-2 bg-white/20 px-1.5 rounded-full text-[10px]">{filteredGRNs.length}</span>
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-[300px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari No. PO, GRN, atau Vendor..."
                                className="pl-9 border-black focus-visible:ring-black font-medium"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Pending POs Tab */}
                <TabsContent value="pending" className="mt-0 space-y-4">
                    <Card className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-zinc-100/50 border-b border-black">
                                    <tr>
                                        <th className="h-12 px-4 font-black uppercase text-xs">PO Number</th>
                                        <th className="h-12 px-4 font-black uppercase text-xs">Vendor</th>
                                        <th className="h-12 px-4 font-black uppercase text-xs">Tanggal</th>
                                        <th className="h-12 px-4 font-black uppercase text-xs">Status</th>
                                        <th className="h-12 px-4 font-black uppercase text-xs text-center">Items</th>
                                        <th className="h-12 px-4 font-black uppercase text-xs text-right">Total</th>
                                        <th className="h-12 px-4 font-black uppercase text-xs text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPOs.map((po) => (
                                        <tr key={po.id} className="group hover:bg-zinc-50 border-b border-black/5 last:border-0 transition-colors">
                                            <td className="p-4 font-mono font-bold text-blue-600">{po.number}</td>
                                            <td className="p-4 font-bold">{po.vendorName}</td>
                                            <td className="p-4 text-muted-foreground font-medium">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-3.5 w-3.5 opacity-70" />
                                                    {new Date(po.orderDate).toLocaleDateString('id-ID')}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <Badge variant="outline" className="font-bold uppercase text-[10px] border bg-blue-100 text-blue-700 border-blue-200">
                                                    {po.status}
                                                </Badge>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="font-bold">{po.items.filter(i => i.remainingQty > 0).length}</span>
                                                <span className="text-muted-foreground text-xs"> / {po.items.length}</span>
                                            </td>
                                            <td className="p-4 text-right font-black">{formatIDR(po.totalAmount)}</td>
                                            <td className="p-4 text-right">
                                                <CreateGRNDialog
                                                    purchaseOrder={po}
                                                    warehouses={warehouses}
                                                    employees={employees}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredPOs.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="p-12 text-center text-muted-foreground">
                                                <Truck className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                                <p>Tidak ada PO yang menunggu penerimaan.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </TabsContent>

                {/* GRN History Tab */}
                <TabsContent value="grns" className="mt-0 space-y-4">
                    <Card className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-zinc-100/50 border-b border-black">
                                    <tr>
                                        <th className="h-12 px-4 font-black uppercase text-xs">GRN Number</th>
                                        <th className="h-12 px-4 font-black uppercase text-xs">PO</th>
                                        <th className="h-12 px-4 font-black uppercase text-xs">Vendor</th>
                                        <th className="h-12 px-4 font-black uppercase text-xs">Gudang</th>
                                        <th className="h-12 px-4 font-black uppercase text-xs">Tanggal</th>
                                        <th className="h-12 px-4 font-black uppercase text-xs">Status</th>
                                        <th className="h-12 px-4 font-black uppercase text-xs text-center">Diterima</th>
                                        <th className="h-12 px-4 font-black uppercase text-xs text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredGRNs.map((grn) => (
                                        <tr 
                                            key={grn.id} 
                                            className="group hover:bg-zinc-50 border-b border-black/5 last:border-0 transition-colors cursor-pointer"
                                            onClick={() => setSelectedGRN(grn)}
                                        >
                                            <td className="p-4 font-mono font-bold text-emerald-600">{grn.number}</td>
                                            <td className="p-4 font-medium text-blue-600">{grn.poNumber}</td>
                                            <td className="p-4 font-bold">{grn.vendorName}</td>
                                            <td className="p-4 text-muted-foreground">{grn.warehouseName}</td>
                                            <td className="p-4 text-muted-foreground font-medium">
                                                {new Date(grn.receivedDate).toLocaleDateString('id-ID')}
                                            </td>
                                            <td className="p-4">
                                                <Badge variant="outline" className={`font-bold uppercase text-[10px] border ${getStatusStyle(grn.status)}`}>
                                                    {grn.status}
                                                </Badge>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="font-bold text-emerald-600">{grn.totalAccepted}</span>
                                                {grn.totalRejected > 0 && (
                                                    <span className="text-red-500 text-xs ml-1">(-{grn.totalRejected})</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    className="border-black text-xs font-bold"
                                                    onClick={(e) => { e.stopPropagation(); setSelectedGRN(grn); }}
                                                >
                                                    Detail
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredGRNs.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="p-12 text-center text-muted-foreground">
                                                <ClipboardCheck className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                                <p>Belum ada riwayat penerimaan barang.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* GRN Details Sheet */}
            <GRNDetailsSheet
                grn={selectedGRN}
                isOpen={!!selectedGRN}
                onClose={() => setSelectedGRN(null)}
            />
        </div>
    )
}
