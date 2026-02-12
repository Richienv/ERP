"use client"

import { useState } from "react"
import {
    Search,
    Filter,
    ArrowRight,
    Calendar,
    Download,
    FileText,
    Truck,
    Eye,
    MessageSquare,
    Mail
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
import {
    Card
} from "@/components/ui/card"

import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"

import { formatIDR } from "@/lib/utils"
import { NewPurchaseOrderDialog } from "@/components/procurement/new-po-dialog"
import { POFinalizeDialog } from "@/components/procurement/po-finalize-dialog"

interface Order {
    id: string
    dbId: string
    vendor: string
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

    const filteredOrders = initialOrders.filter(order =>
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.vendor.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const activeOrders = filteredOrders.filter(o => ['PO_DRAFT', 'PENDING_APPROVAL', 'ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED'].includes(o.status))
    const approvedOrders = filteredOrders.filter(o => o.status === 'APPROVED')

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'COMPLETED': case 'RECEIVED':
                return 'bg-zinc-100 text-zinc-600 border-zinc-200'
            case 'ORDERED': case 'VENDOR_CONFIRMED': case 'SHIPPED': case 'SENT':
                return 'bg-blue-100 text-blue-700 border-blue-200'
            case 'APPROVED':
                return 'bg-emerald-100 text-emerald-700 border-emerald-200'
            case 'PENDING_APPROVAL':
                return 'bg-amber-100 text-amber-700 border-amber-200'
            case 'PO_DRAFT':
                return 'bg-zinc-50 text-zinc-500 border-dashed border-zinc-300'
            case 'REJECTED': case 'CANCELLED':
                return 'bg-red-50 text-red-600 border-red-200'
            default:
                return 'bg-zinc-50 text-zinc-500 border-zinc-200'
        }
    }

    const [finalizePO, setFinalizePO] = useState<Order | null>(null)

    const OrdersTable = ({ data }: { data: Order[] }) => (
        <Card className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-zinc-100/50 border-b border-black">
                        <tr>
                            <th className="h-12 px-4 font-black uppercase text-xs w-[140px]">PO Number</th>
                            <th className="h-12 px-4 font-black uppercase text-xs">Vendor</th>
                            <th className="h-12 px-4 font-black uppercase text-xs">Date</th>
                            <th className="h-12 px-4 font-black uppercase text-xs">Requested / Apprv</th>
                            <th className="h-12 px-4 font-black uppercase text-xs">Status</th>
                            <th className="h-12 px-4 font-black uppercase text-xs text-right">Total</th>
                            <th className="h-12 px-4 font-black uppercase text-xs text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((po) => (
                            <tr key={po.dbId} className="group hover:bg-zinc-50 border-b border-black/5 last:border-0 transition-colors">
                                <td className="p-4 font-bold text-xs text-blue-600 group-hover:underline">{po.id}</td>
                                <td className="p-4">
                                    <div className="font-bold text-xs">{po.vendor}</div>
                                    <div className="text-[10px] text-muted-foreground font-medium uppercase mt-0.5 flex items-center gap-1">
                                        <Truck className="h-3 w-3" /> ETA: {po.eta}
                                    </div>
                                </td>
                                <td className="p-4 text-muted-foreground font-medium text-xs">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-3.5 w-3.5 opacity-70" />
                                        {po.date}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="text-[10px] font-bold uppercase text-zinc-700">Req: {(po as any).requester}</div>
                                        <div className="text-[10px] font-medium text-zinc-500">Appr: {(po as any).approver}</div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <Badge variant="outline" className={`font-bold uppercase text-[10px] shadow-sm border ${getStatusStyle(po.status)}`}>
                                        {po.status}
                                    </Badge>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="font-black text-xs">{formatIDR(po.total)}</div>
                                    <div className="text-[10px] text-muted-foreground font-medium">{po.items} Items</div>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                        <a href={`/api/documents/purchase-order/${po.dbId}?disposition=inline`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-black hover:text-white rounded-full" title="View PDF">
                                                <Eye className="h-3.5 w-3.5" />
                                            </Button>
                                        </a>
                                        <a href={`/api/documents/purchase-order/${po.dbId}?disposition=inline`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-black hover:text-white rounded-full">
                                                <Download className="h-3.5 w-3.5" />
                                            </Button>
                                        </a>
                                        {po.status === 'PO_DRAFT' ? (
                                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-black hover:text-white rounded-full" onClick={(e) => { e.stopPropagation(); setFinalizePO(po) }}>
                                                <ArrowRight className="h-3.5 w-3.5" />
                                            </Button>
                                        ) : po.status === 'APPROVED' ? (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-emerald-600 hover:text-white rounded-full">
                                                        <MessageSquare className="h-3.5 w-3.5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenuItem
                                                        className="cursor-pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            const pdfUrl = `${window.location.origin}/api/documents/purchase-order/${po.dbId}?disposition=inline`
                                                            const message = `Hello! Please find attached Purchase Order ${po.id}. Total: ${formatIDR(po.total)}. PDF: ${pdfUrl}`
                                                            const phone = (po as any).vendorPhone || ''
                                                            const whatsappUrl = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
                                                            window.open(whatsappUrl, '_blank')
                                                        }}
                                                    >
                                                        <MessageSquare className="h-4 w-4 mr-2" />
                                                        WhatsApp
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="cursor-pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            const pdfUrl = `${window.location.origin}/api/documents/purchase-order/${po.dbId}?disposition=inline`
                                                            const subject = `Purchase Order ${po.id}`
                                                            const body = `Dear Vendor,%0D%0A%0D%0APlease find our Purchase Order attached.%0D%0APO Number: ${po.id}%0D%0ATotal Amount: ${formatIDR(po.total)}%0D%0A%0D%0APDF Link: ${pdfUrl}%0D%0A%0D%0AThank you.`
                                                            const vendorEmail = (po as any).vendorEmail || ''
                                                            const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${vendorEmail}&su=${encodeURIComponent(subject)}&body=${body}`
                                                            window.open(gmailUrl, '_blank')
                                                        }}
                                                    >
                                                        <Mail className="h-4 w-4 mr-2" />
                                                        Gmail
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        ) : (
                                            <a href={`/api/documents/purchase-order/${po.dbId}?disposition=inline`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-emerald-600 hover:text-white rounded-full" title="View PDF">
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Button>
                                            </a>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {data.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-12 text-center text-muted-foreground">
                                    No orders found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    )

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight text-black flex items-center gap-2">
                        <FileText className="h-8 w-8" /> Pesanan Pembelian (PO)
                    </h2>
                    <p className="text-muted-foreground mt-1 font-medium">Lacak status pesanan dan pengiriman masuk.</p>
                </div>

                <NewPurchaseOrderDialog vendors={vendors} products={products} />
            </div>

            {/* Tabs & Filters */}
            <Tabs defaultValue="all" className="w-full">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                    <TabsList className="bg-zinc-100 border border-black p-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <TabsTrigger value="all" className="data-[state=active]:bg-black data-[state=active]:text-white font-bold uppercase text-xs">
                            All Orders <span className="ml-2 bg-white/20 px-1.5 rounded-full text-[10px]">{filteredOrders.length}</span>
                        </TabsTrigger>
                        <TabsTrigger value="active" className="data-[state=active]:bg-black data-[state=active]:text-white font-bold uppercase text-xs">
                            Active <span className="ml-2 bg-white/20 px-1.5 rounded-full text-[10px]">{activeOrders.length}</span>
                        </TabsTrigger>
                        <TabsTrigger value="approved" className="data-[state=active]:bg-black data-[state=active]:text-white font-bold uppercase text-xs">
                            Approved
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-[300px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari No. PO atau Vendor..."
                                className="pl-9 border-black focus-visible:ring-black font-medium"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" size="icon" className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none hover:bg-zinc-100">
                            <Filter className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <TabsContent value="all" className="mt-0 space-y-4">
                    <OrdersTable data={filteredOrders} />
                </TabsContent>

                <TabsContent value="active" className="mt-0 space-y-4">
                    <OrdersTable data={activeOrders} />
                </TabsContent>

                <TabsContent value="approved" className="mt-0 space-y-4">
                    <OrdersTable data={approvedOrders} />
                </TabsContent>
            </Tabs>

            <POFinalizeDialog
                poId={finalizePO?.dbId || null}
                isOpen={!!finalizePO}
                onClose={() => setFinalizePO(null)}
                vendors={vendors}
            />
        </div>
    )
}
