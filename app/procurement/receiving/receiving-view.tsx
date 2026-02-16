"use client"

import { useState } from "react"
import {
    Search,
    Package,
    CheckCircle2,
    Truck,
    ClipboardCheck,
    Calendar,
    FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
    const [activeTab, setActiveTab] = useState<"pending" | "grns">("pending")

    const filteredPOs = pendingPOs.filter(po =>
        po.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const filteredGRNs = grns.filter(grn =>
        grn.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grn.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grn.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const draftGRNs = grns.filter(g => g.status === 'DRAFT')
    const acceptedGRNs = grns.filter(g => g.status === 'ACCEPTED')

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'ACCEPTED':
                return 'bg-emerald-50 text-emerald-700 border-emerald-300'
            case 'DRAFT':
                return 'bg-amber-50 text-amber-700 border-amber-300'
            case 'INSPECTING':
                return 'bg-blue-50 text-blue-700 border-blue-300'
            case 'REJECTED':
                return 'bg-red-50 text-red-600 border-red-300'
            default:
                return 'bg-zinc-100 text-zinc-600 border-zinc-300'
        }
    }

    return (
        <div className="p-4 md:p-8 pt-6 max-w-[1600px] mx-auto space-y-4 bg-zinc-50 dark:bg-black min-h-screen">

            {/* ═══ COMMAND HEADER ═══ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-emerald-400">
                    <div className="flex items-center gap-3">
                        <ClipboardCheck className="h-5 w-5 text-emerald-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Penerimaan Barang (GRN)
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Terima dan verifikasi barang masuk dari supplier
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ KPI PULSE STRIP ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Truck className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">PO Menunggu</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">{pendingPOs.length}</div>
                        <div className="text-[10px] font-bold text-blue-600 mt-1">Ready to receive</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">GRN Draft</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-amber-600">{draftGRNs.length}</div>
                        <div className="text-[10px] font-bold text-amber-600 mt-1">Pending acceptance</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Diterima</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-600">{acceptedGRNs.length}</div>
                        <div className="text-[10px] font-bold text-emerald-600 mt-1">GRN selesai</div>
                    </div>
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Item Diterima</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-indigo-600">
                            {acceptedGRNs.reduce((sum, g) => sum + g.totalAccepted, 0)}
                        </div>
                        <div className="text-[10px] font-bold text-indigo-600 mt-1">Unit bulan ini</div>
                    </div>
                </div>
            </div>

            {/* ═══ SEARCH & TAB BAR ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            placeholder="Cari No. PO, GRN, atau Vendor..."
                            className="pl-9 border-2 border-black font-bold h-10 placeholder:text-zinc-400 rounded-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex border-2 border-black">
                        <button
                            onClick={() => setActiveTab("pending")}
                            className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-r border-black flex items-center gap-1.5 ${
                                activeTab === "pending" ? "bg-black text-white" : "bg-white text-zinc-400 hover:bg-zinc-50"
                            }`}
                        >
                            PO Menunggu <span className={`text-[9px] px-1 ${activeTab === "pending" ? "bg-white/20" : "bg-zinc-200"} rounded-full`}>{filteredPOs.length}</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("grns")}
                            className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                                activeTab === "grns" ? "bg-black text-white" : "bg-white text-zinc-400 hover:bg-zinc-50"
                            }`}
                        >
                            Riwayat GRN <span className={`text-[9px] px-1 ${activeTab === "grns" ? "bg-white/20" : "bg-zinc-200"} rounded-full`}>{filteredGRNs.length}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══ PENDING POs TABLE ═══ */}
            {activeTab === "pending" && (
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-50 dark:bg-zinc-800 border-b-2 border-black">
                                <tr>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">PO Number</th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Vendor</th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Tanggal</th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Items</th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Total</th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {filteredPOs.map((po) => (
                                    <tr key={po.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="p-4 font-mono font-bold text-xs text-blue-600">{po.number}</td>
                                        <td className="p-4 font-bold text-xs text-zinc-900 dark:text-white">{po.vendorName}</td>
                                        <td className="p-4 text-zinc-500 font-medium text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="h-3 w-3 opacity-70" />
                                                {new Date(po.orderDate).toLocaleDateString('id-ID')}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <Badge variant="outline" className="font-black uppercase text-[9px] tracking-widest border bg-blue-50 text-blue-700 border-blue-300">
                                                {po.status}
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="font-black text-xs">{po.items.filter(i => i.remainingQty > 0).length}</span>
                                            <span className="text-zinc-400 text-[10px]"> / {po.items.length}</span>
                                        </td>
                                        <td className="p-4 text-right font-black text-xs">{formatIDR(po.totalAmount)}</td>
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
                                        <td colSpan={7} className="p-12 text-center">
                                            <Truck className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tidak ada PO yang menunggu penerimaan</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══ GRN HISTORY TABLE ═══ */}
            {activeTab === "grns" && (
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-50 dark:bg-zinc-800 border-b-2 border-black">
                                <tr>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">GRN Number</th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">PO</th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Vendor</th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Gudang</th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Tanggal</th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Diterima</th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {filteredGRNs.map((grn) => (
                                    <tr
                                        key={grn.id}
                                        className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                        onClick={() => setSelectedGRN(grn)}
                                    >
                                        <td className="p-4 font-mono font-bold text-xs text-emerald-600">{grn.number}</td>
                                        <td className="p-4 font-medium text-xs text-blue-600">{grn.poNumber}</td>
                                        <td className="p-4 font-bold text-xs text-zinc-900 dark:text-white">{grn.vendorName}</td>
                                        <td className="p-4 text-zinc-500 text-xs">{grn.warehouseName}</td>
                                        <td className="p-4 text-zinc-500 font-medium text-xs">
                                            {new Date(grn.receivedDate).toLocaleDateString('id-ID')}
                                        </td>
                                        <td className="p-4">
                                            <Badge variant="outline" className={`font-black uppercase text-[9px] tracking-widest border ${getStatusStyle(grn.status)}`}>
                                                {grn.status}
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="font-black text-xs text-emerald-600">{grn.totalAccepted}</span>
                                            {grn.totalRejected > 0 && (
                                                <span className="text-red-500 text-[10px] ml-1">(-{grn.totalRejected})</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="border-2 border-black text-[10px] font-black uppercase tracking-widest h-7"
                                                onClick={(e) => { e.stopPropagation(); setSelectedGRN(grn); }}
                                            >
                                                Detail
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredGRNs.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="p-12 text-center">
                                            <ClipboardCheck className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ada riwayat penerimaan barang</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* GRN Details Sheet */}
            <GRNDetailsSheet
                grn={selectedGRN}
                isOpen={!!selectedGRN}
                onClose={() => setSelectedGRN(null)}
            />
        </div>
    )
}
