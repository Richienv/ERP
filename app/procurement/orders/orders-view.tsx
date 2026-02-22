"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
    Search,
    ArrowRight,
    Calendar,
    Download,
    FileText,
    Truck,
    Eye,
    MessageSquare,
    Mail,
    Loader2,
    ShoppingCart,
    CheckCircle2,
    Clock,
    AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatIDR } from "@/lib/utils"
import { NewPurchaseOrderDialog } from "@/components/procurement/new-po-dialog"
import { POFinalizeDialog } from "@/components/procurement/po-finalize-dialog"
import { markAsOrdered } from "@/lib/actions/procurement"
import { toast } from "sonner"

interface Order {
    id: string
    dbId: string
    vendor: string
    vendorEmail?: string
    vendorPhone?: string
    date: string
    total: number
    status: string
    items: number
    eta: string
}

interface OrdersViewProps {
    initialOrders: Order[]
    vendors: { id: string, name: string }[]
    products: { id: string, name: string, code: string, unit: string, defaultPrice: number }[]
}

export function OrdersView({ initialOrders, vendors, products }: OrdersViewProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [filterStatus, setFilterStatus] = useState<string>("ALL")
    const [sendingOrderId, setSendingOrderId] = useState<string | null>(null)
    const queryClient = useQueryClient()

    const filteredOrders = initialOrders.filter(order => {
        const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.vendor.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = filterStatus === "ALL" ||
            (filterStatus === "ACTIVE" && ['PO_DRAFT', 'PENDING_APPROVAL', 'ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED'].includes(order.status)) ||
            (filterStatus === "APPROVED" && order.status === 'APPROVED') ||
            (filterStatus === "COMPLETED" && ['COMPLETED', 'RECEIVED'].includes(order.status))
        return matchesSearch && matchesStatus
    })

    // Stats
    const totalOrders = initialOrders.length
    const activeOrders = initialOrders.filter(o => ['PO_DRAFT', 'PENDING_APPROVAL', 'ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED'].includes(o.status)).length
    const approvedOrders = initialOrders.filter(o => o.status === 'APPROVED').length
    const completedOrders = initialOrders.filter(o => ['COMPLETED', 'RECEIVED'].includes(o.status)).length

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'COMPLETED': case 'RECEIVED':
                return 'bg-zinc-100 text-zinc-600 border-zinc-300'
            case 'ORDERED': case 'VENDOR_CONFIRMED': case 'SHIPPED': case 'SENT':
                return 'bg-blue-50 text-blue-700 border-blue-300'
            case 'APPROVED':
                return 'bg-emerald-50 text-emerald-700 border-emerald-300'
            case 'PENDING_APPROVAL':
                return 'bg-amber-50 text-amber-700 border-amber-300'
            case 'PO_DRAFT':
                return 'bg-zinc-50 text-zinc-500 border-dashed border-zinc-300'
            case 'REJECTED': case 'CANCELLED':
                return 'bg-red-50 text-red-600 border-red-300'
            default:
                return 'bg-zinc-50 text-zinc-500 border-zinc-300'
        }
    }

    const [finalizePO, setFinalizePO] = useState<Order | null>(null)

    const invalidateAfterAction = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
    }

    const handleConfirmSent = async (po: Order) => {
        try {
            const orderedResult = await markAsOrdered(po.dbId)
            if (!orderedResult.success) {
                throw new Error((orderedResult as any).error || "Failed to mark PO as ORDERED")
            }
            invalidateAfterAction()
            toast.success(`PO ${po.id} ditandai sebagai Ordered`)
        } catch (error: any) {
            toast.error(error?.message || "Gagal menandai PO sebagai Ordered")
        }
    }

    const handleSendToVendor = async (po: Order, channel: "whatsapp" | "gmail") => {
        setSendingOrderId(po.dbId)
        try {
            const phone = (po.vendorPhone || "").replace(/\D/g, "")
            const vendorEmail = po.vendorEmail || ""
            if (channel === "whatsapp" && !phone) throw new Error("Vendor WhatsApp number not found")
            if (channel === "gmail" && !vendorEmail) throw new Error("Vendor email not found")

            const pdfUrl = `${window.location.origin}/api/documents/purchase-order/${po.dbId}?disposition=inline`
            if (channel === "whatsapp") {
                const message = `Hello! Please find attached Purchase Order ${po.id}. Total: ${formatIDR(po.total)}. PDF: ${pdfUrl}`
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank")
            } else {
                const subject = `Purchase Order ${po.id}`
                const body = `Dear Vendor,%0D%0A%0D%0APlease find our Purchase Order attached.%0D%0APO Number: ${po.id}%0D%0ATotal Amount: ${formatIDR(po.total)}%0D%0A%0D%0APDF Link: ${pdfUrl}%0D%0A%0D%0AThank you.`
                window.open(`https://mail.google.com/mail/?view=cm&to=${vendorEmail}&su=${encodeURIComponent(subject)}&body=${body}`, "_blank")
            }

            // Ask user to confirm the message was actually sent before marking as ORDERED
            const confirmed = window.confirm('Pesan sudah terkirim ke vendor? Klik OK untuk menandai PO sebagai ORDERED.')
            if (confirmed) {
                await handleConfirmSent(po)
            } else {
                toast.info('PO belum ditandai sebagai Ordered. Anda bisa mengirim ulang nanti.')
            }
        } catch (error: any) {
            toast.error(error?.message || "Failed to send PO to vendor")
        } finally {
            setSendingOrderId(null)
        }
    }

    return (
        <div className="mf-page">

            {/* ═══ COMMAND HEADER ═══ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-blue-400">
                    <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-blue-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Pesanan Pembelian (PO)
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Lacak status pesanan dan pengiriman masuk
                            </p>
                        </div>
                    </div>
                    <NewPurchaseOrderDialog vendors={vendors} products={products} />
                </div>
            </div>

            {/* ═══ KPI PULSE STRIP ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <ShoppingCart className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total PO</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">{totalOrders}</div>
                        <div className="text-[10px] font-bold text-blue-600 mt-1">Semua pesanan</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Aktif</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-amber-600">{activeOrders}</div>
                        <div className="text-[10px] font-bold text-amber-600 mt-1">Dalam proses</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Disetujui</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-600">{approvedOrders}</div>
                        <div className="text-[10px] font-bold text-emerald-600 mt-1">Siap kirim</div>
                    </div>
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Truck className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Selesai</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-600">{completedOrders}</div>
                        <div className="text-[10px] font-bold text-zinc-500 mt-1">Diterima</div>
                    </div>
                </div>
            </div>

            {/* ═══ SEARCH & FILTER BAR ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Cari No. PO atau Vendor..."
                            className="pl-9 border-2 border-black font-bold h-10 placeholder:text-zinc-400 rounded-none"
                        />
                    </div>
                    <div className="flex border-2 border-black">
                        {(["ALL", "ACTIVE", "APPROVED", "COMPLETED"] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-r border-black last:border-r-0 ${
                                    filterStatus === s
                                        ? "bg-black text-white"
                                        : "bg-white text-zinc-400 hover:bg-zinc-50"
                                }`}
                            >
                                {s === "ALL" ? "Semua" : s === "ACTIVE" ? "Aktif" : s === "APPROVED" ? "Disetujui" : "Selesai"}
                            </button>
                        ))}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hidden md:block">
                        {filteredOrders.length} pesanan
                    </div>
                </div>
            </div>

            {/* ═══ ORDERS TABLE ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 dark:bg-zinc-800 border-b-2 border-black">
                            <tr>
                                <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 w-[130px]">PO Number</th>
                                <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Vendor</th>
                                <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Tanggal</th>
                                <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Req / Apprv</th>
                                <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</th>
                                <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Total</th>
                                <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {filteredOrders.map((po) => (
                                <tr key={po.dbId} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <td className="p-4 font-bold text-xs text-blue-600">{po.id}</td>
                                    <td className="p-4">
                                        <div className="font-bold text-xs text-zinc-900 dark:text-white">{po.vendor}</div>
                                        <div className="text-[10px] text-zinc-400 font-medium uppercase mt-0.5 flex items-center gap-1">
                                            <Truck className="h-3 w-3" /> ETA: {po.eta}
                                        </div>
                                    </td>
                                    <td className="p-4 text-zinc-500 font-medium text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="h-3 w-3 opacity-70" />
                                            {po.date}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="text-[10px] font-bold uppercase text-zinc-700 dark:text-zinc-300">Req: {(po as any).requester}</div>
                                            <div className="text-[10px] font-medium text-zinc-400">Appr: {(po as any).approver}</div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <Badge variant="outline" className={`font-black uppercase text-[9px] tracking-widest border ${getStatusStyle(po.status)}`}>
                                            {po.status}
                                        </Badge>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="font-black text-xs text-zinc-900 dark:text-white">{formatIDR(po.total)}</div>
                                        <div className="text-[10px] text-zinc-400 font-medium">{po.items} Items</div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                            <a href={`/api/documents/purchase-order/${po.dbId}?disposition=inline`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-black hover:text-white" title="View PDF">
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Button>
                                            </a>
                                            <a href={`/api/documents/purchase-order/${po.dbId}?disposition=attachment`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-black hover:text-white" title="Download PDF">
                                                    <Download className="h-3.5 w-3.5" />
                                                </Button>
                                            </a>
                                            {po.status === 'PO_DRAFT' ? (
                                                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-black hover:text-white" onClick={(e) => { e.stopPropagation(); setFinalizePO(po) }}>
                                                    <ArrowRight className="h-3.5 w-3.5" />
                                                </Button>
                                            ) : po.status === 'APPROVED' ? (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-emerald-600 hover:text-white" disabled={sendingOrderId === po.dbId}>
                                                            {sendingOrderId === po.dbId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenuItem
                                                            className="cursor-pointer text-xs font-bold"
                                                            disabled={sendingOrderId === po.dbId}
                                                            onClick={(e) => { e.stopPropagation(); handleSendToVendor(po, "whatsapp") }}
                                                        >
                                                            <MessageSquare className="h-4 w-4 mr-2" />
                                                            Send WhatsApp + Mark Ordered
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="cursor-pointer text-xs font-bold"
                                                            disabled={sendingOrderId === po.dbId}
                                                            onClick={(e) => { e.stopPropagation(); handleSendToVendor(po, "gmail") }}
                                                        >
                                                            <Mail className="h-4 w-4 mr-2" />
                                                            Send Gmail + Mark Ordered
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            ) : (
                                                <a href={`/api/documents/purchase-order/${po.dbId}?disposition=inline`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-emerald-600 hover:text-white" title="View PDF">
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </Button>
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredOrders.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center">
                                        <FileText className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tidak ada pesanan yang ditemukan</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <POFinalizeDialog
                poId={finalizePO?.dbId || null}
                isOpen={!!finalizePO}
                onClose={() => setFinalizePO(null)}
                vendors={vendors}
            />
        </div>
    )
}
