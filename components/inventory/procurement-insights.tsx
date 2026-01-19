
import { getProcurementInsights } from "@/app/actions/inventory"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, ArrowUpRight, CheckCircle2, Clock, DollarSign, Truck, AlertOctagon } from "lucide-react"

export async function ProcurementInsights() {
    const data = await getProcurementInsights()

    const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)
    const formatDate = (date: any) => {
        if (!date) return 'TBA'
        try {
            return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(date))
        } catch (e) {
            return 'Invalid Date'
        }
    }

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-black mb-4 text-foreground uppercase tracking-tight flex items-center gap-2">
                <Truck className="h-6 w-6 text-indigo-600" />
                Procurement & Restock Insights
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* 1. IMMEDIATE RESTOCK NEEDS (Left Panel) */}
                <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white h-full flex flex-col">
                    <CardHeader className="bg-red-50 border-b-2 border-black pb-3">
                        <CardTitle className="text-sm font-black uppercase flex items-center justify-between text-red-700">
                            <span>Immediate Restock Needs</span>
                            <AlertCircle className="h-4 w-4" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 flex-1 flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-3xl font-black text-red-600">{formatCurrency(data.summary.totalRestockCost)}</p>
                                <p className="text-xs font-bold text-muted-foreground mt-1">
                                    Capital required for {data.summary.itemsCriticalCount} critical items.
                                </p>
                            </div>
                            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 font-bold">
                                Pending Approval
                            </Badge>
                        </div>

                        {/* Critical Items List */}
                        <div className="flex-1 space-y-2 mt-2">
                            <p className="text-[10px] font-black uppercase text-zinc-400 mb-2">Top Critical Items Breakdown</p>
                            {data.summary.itemsCriticalList && data.summary.itemsCriticalList.slice(0, 4).map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded border border-black/5 bg-zinc-50 hover:bg-zinc-100 transition-colors">
                                    <div>
                                        <div className="font-bold text-sm text-zinc-800">{item.name}</div>
                                        <div className="text-[10px] text-zinc-500 font-medium">
                                            Gap: <span className="text-red-600 font-bold">{item.deficit} {item.unit}</span> • Rec: {item.lastVendor}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-black text-red-600">
                                            {item.deadlineDays <= 2 ? '⚠️ URGENT' : `${item.deadlineDays} Days left`}
                                        </div>
                                        <div className="text-[10px] text-zinc-400">
                                            {formatCurrency(item.totalCost)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {data.summary.itemsCriticalList && data.summary.itemsCriticalList.length > 4 && (
                                <div className="text-center text-xs font-bold text-indigo-600 cursor-pointer pt-2">
                                    + {data.summary.itemsCriticalList.length - 4} more items...
                                </div>
                            )}
                        </div>

                        <Link href="/procurement/requests/create?type=bulk_restock" className="w-full block mt-auto pt-4">
                            <button className="w-full py-3 bg-red-600 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-white text-xs font-black uppercase tracking-wide hover:bg-red-700 hover:translate-y-[1px] hover:shadow-none transition-all flex items-center justify-center gap-2">
                                <DollarSign className="h-4 w-4" /> Request Budget Approval
                            </button>
                        </Link>
                    </CardContent>
                </Card>

                {/* 2. INCOMING INVENTORY (Right Panel) */}
                <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white h-full flex flex-col">
                    <CardHeader className="bg-blue-50 border-b-2 border-black pb-3">
                        <CardTitle className="text-sm font-black uppercase flex items-center justify-between text-blue-700">
                            <span>Incoming Inventory (Active POs)</span>
                            <Clock className="h-4 w-4" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 flex-1 flex flex-col gap-4">
                        <div className="flex justify-between items-end border-b border-black/10 pb-4">
                            <div>
                                <p className="text-3xl font-black text-slate-900">{data.summary.totalIncoming} <span className="text-lg text-muted-foreground">Orders</span></p>
                                <p className="text-xs font-bold text-muted-foreground mt-1">
                                    Processing or In-Transit from Vendors.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4 overflow-y-auto max-h-[320px] pr-2">
                            {data.activePOs.map((po: any) => (
                                <div key={po.id} className="group relative border border-zinc-200 rounded-lg p-3 hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                                    {/* Header: Vendor & ETA */}
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 bg-white border border-black/10 rounded flex items-center justify-center shrink-0">
                                                <Truck className="h-4 w-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <div className="font-black text-sm text-zinc-900">{po.vendor}</div>
                                                <div className="text-[10px] text-zinc-500 font-mono">PO: {po.poNumber} • {po.contact}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-xs font-black px-2 py-0.5 rounded border ${po.daysUntilarrival <= 3 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                                                ETA: {formatDate(po.eta)}
                                            </div>
                                            <div className="text-[10px] font-bold text-zinc-400 mt-1">
                                                {po.daysUntilarrival} days left
                                            </div>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="space-y-1 mb-3">
                                        <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-500">
                                            <span>{po.trackingStatus}</span>
                                            <span>{po.progress}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                                            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${po.progress}%` }} />
                                        </div>
                                    </div>

                                    {/* Material Summary */}
                                    <div className="bg-white/50 p-2 rounded border border-dashed border-zinc-300">
                                        <div className="text-[10px] font-bold text-zinc-500 mb-1 uppercase tracking-wider">Contains:</div>
                                        <div className="flex flex-wrap gap-1">
                                            {po.items?.map((item: any, i: number) => (
                                                <span key={i} className="text-[10px] font-medium bg-white border border-zinc-200 px-1.5 py-0.5 rounded text-zinc-700">
                                                    {item.name}
                                                </span>
                                            ))}
                                            {po.totalItems > 3 && <span className="text-[10px] text-zinc-400">+ more</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {data.activePOs.length === 0 && (
                                <div className="text-center py-8 text-zinc-400 text-sm font-bold bg-zinc-50 rounded border border-dashed border-zinc-200">
                                    No incoming orders currently.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
