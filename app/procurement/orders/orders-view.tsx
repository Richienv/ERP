"use client"

import { useState } from "react"
import {
    Search,
    Filter,
    ArrowRight,
    Calendar,
    Download,
    FileText,
    Truck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card } from "@/components/ui/card"

import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"

import { formatIDR } from "@/lib/utils"
import { NewPurchaseOrderDialog } from "@/components/procurement/new-po-dialog"

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

    const activeOrders = filteredOrders.filter(o => ['OPEN', 'PARTIAL', 'APPROVED', 'SENT'].includes(o.status))
    const completedOrders = filteredOrders.filter(o => ['COMPLETED', 'RECEIVED', 'CLOSED'].includes(o.status))

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'Received': case 'COMPLETED': case 'CLOSED':
                return 'bg-zinc-100 text-zinc-600 border-zinc-200'
            case 'Sent': case 'PARTIAL':
                return 'bg-blue-100 text-blue-700 border-blue-200'
            case 'Approved': case 'OPEN':
                return 'bg-emerald-100 text-emerald-700 border-emerald-200'
            default:
                return 'bg-amber-50 text-amber-700 border-amber-200'
        }
    }

    const OrdersTable = ({ data }: { data: Order[] }) => (
        <Card className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-zinc-100/50 border-b border-black">
                        <tr>
                            <th className="h-12 px-4 font-black uppercase text-xs w-[180px]">PO Number</th>
                            <th className="h-12 px-4 font-black uppercase text-xs">Vendor</th>
                            <th className="h-12 px-4 font-black uppercase text-xs">Date</th>
                            <th className="h-12 px-4 font-black uppercase text-xs">Status</th>
                            <th className="h-12 px-4 font-black uppercase text-xs text-right">Total</th>
                            <th className="h-12 px-4 font-black uppercase text-xs text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((po) => (
                            <tr key={po.dbId} className="group hover:bg-zinc-50 border-b border-black/5 last:border-0 transition-colors cursor-pointer">
                                <td className="p-4 font-mono font-bold text-blue-600 group-hover:underline">{po.id}</td>
                                <td className="p-4">
                                    <div className="font-bold">{po.vendor}</div>
                                    <div className="text-[10px] text-muted-foreground font-medium uppercase mt-0.5 flex items-center gap-1">
                                        <Truck className="h-3 w-3" /> ETA: {po.eta}
                                    </div>
                                </td>
                                <td className="p-4 text-muted-foreground font-medium">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-3.5 w-3.5 opacity-70" />
                                        {po.date}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <Badge variant="outline" className={`font-bold uppercase text-[10px] shadow-sm border ${getStatusStyle(po.status)}`}>
                                        {po.status}
                                    </Badge>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="font-black text-sm">{formatIDR(po.total)}</div>
                                    <div className="text-[10px] text-muted-foreground font-medium">{po.items} Items</div>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <a href={`/api/documents/purchase-order/${po.dbId}`} target="_blank" rel="noreferrer">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-black hover:text-white rounded-full">
                                                <Download className="h-4 w-4" />
                                            </Button>
                                        </a>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-black hover:text-white rounded-full">
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {data.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-12 text-center text-muted-foreground">
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
                        <TabsTrigger value="completed" className="data-[state=active]:bg-black data-[state=active]:text-white font-bold uppercase text-xs">
                            Completed
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

                <TabsContent value="completed" className="mt-0 space-y-4">
                    <OrdersTable data={completedOrders} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
