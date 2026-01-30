"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Package, TrendingUp, TrendingDown, AlertCircle, ShoppingCart, Plus, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { GoodsReceiptDialog } from "./goods-receipt-dialog"
import { PurchaseRequestDialog } from "./purchase-request-dialog"
import { ShoppingBag } from "lucide-react"

interface GapData {
    id: string
    name: string
    sku: string
    category: string
    currentStock: number
    unit: string

    // Planning
    minStock: number
    reorderPoint: number
    safetyStock: number
    leadTime: number
    consumptionRate: number
    stockEndsInDays: number

    // Status
    status: string
    gap: number
    isPendingRequest: boolean
    isRejectedRequest?: boolean

    // Financials
    cost: number
    totalGapCost: number

    // Supply Chain
    activePO: {
        number: string
        qty: number
        eta: Date | null
    } | null
    lastProcurement: Date | null
    supplier: {
        name: string
        isPreferred: boolean
    } | null

    // Demand & Locations
    demandSources: {
        id: string
        number: string
        date: Date | null
        qty: number
        productName: string
    }[]
    warehouses: {
        id: string
        name: string
        qty: number
    }[]
    alternative: {
        name: string
        code: string
    } | null

    openPOs: {
        id: string
        number: string
        supplierName: string
        expectedDate: Date | null
        orderedQty: number
        receivedQty: number
        remainingQty: number
        unitPrice: number
    }[]
    manualAlert?: boolean
}

export function DetailedMaterialTable({ data }: { data: GapData[] }) {

    // Optimistic UI State: Stores newly created POs locally before revalidation
    const [optimisticPOs, setOptimisticPOs] = useState<Record<string, any[]>>({})
    // Optimistic UI State: Stores items that have just been received but waiting for server refresh
    const [optimisticResolvedItems, setOptimisticResolvedItems] = useState<Set<string>>(new Set())
    // Optimistic UI State: Stores items that have just been requested (pending approval)
    const [optimisticPendingRequests, setOptimisticPendingRequests] = useState<Set<string>>(new Set())

    const [filter, setFilter] = useState<'alert' | 'requested' | 'approved' | 'rejected' | 'completed'>('alert')

    const filteredData = data.filter(item => {
        if (filter === 'alert') return item.manualAlert || (item.gap > 0 && !item.isPendingRequest && (!item.openPOs || item.openPOs.length === 0))
        if (filter === 'requested') return !item.manualAlert && (item.isPendingRequest || optimisticPendingRequests.has(item.id))
        if (filter === 'approved') return !item.manualAlert && ((item.openPOs && item.openPOs.length > 0) || (optimisticPOs[item.id] && optimisticPOs[item.id].length > 0))
        if (filter === 'rejected') return item.isRejectedRequest
        if (filter === 'completed') return !item.manualAlert && item.gap <= 0 && !item.isPendingRequest && (!item.openPOs || item.openPOs.length === 0)
        return true
    })

    const handlePurchaseSuccess = (itemId: string, result: any) => {
        console.log("[DetailedMaterialTable] handlePurchaseSuccess triggered for:", itemId, result)

        // Handle Pending Request (New Flow)
        if (result.pendingTask) {
            setOptimisticPendingRequests(prev => new Set(prev).add(itemId))
        }
        // Handle Immediate PO (Old Flow - fallback)
        else if (result.newPO) {
            setOptimisticPOs(prev => {
                const currentList = prev[itemId] || []
                const neWList = [...currentList, result.newPO]
                console.log("[DetailedMaterialTable] New optimistic state for item:", neWList)
                return {
                    ...prev,
                    [itemId]: neWList
                }
            })
        }
    }

    const handleReceiptSuccess = (itemId: string) => {
        console.log("[DetailedMaterialTable] handleReceiptSuccess triggered for:", itemId)
        setOptimisticResolvedItems(prev => new Set(prev).add(itemId))
    }

    // Debugging Render
    // console.log("[DetailedMaterialTable] Render. Optimistic Keys:", Object.keys(optimisticPOs))



    if (!data.length) return <div className="p-8 text-center text-muted-foreground border-2 border-dashed border-black">No material data found.</div>

    // Helper for currency
    const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)
    const formatDate = (date: Date | null) => date ? new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'

    return (
        <Card className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white mt-6">
            <CardHeader className="p-6 border-b-2 border-black bg-zinc-50">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
                            <Package className="h-5 w-5 text-purple-600" />
                            Material Gap Analysis
                        </CardTitle>
                        <p className="text-sm text-muted-foreground font-bold mt-1">Real-time Safety Stock, Reorder Points, and Procurement Gaps.</p>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex bg-zinc-100 p-1 rounded-lg border border-zinc-200">
                        <button
                            onClick={() => setFilter('alert')}
                            className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all flex items-center gap-1.5 ${filter === 'alert' ? 'bg-red-600 text-white shadow-sm ring-1 ring-red-700' : 'text-zinc-500 hover:text-red-600'}`}
                        >
                            Alert
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${filter === 'alert' ? 'bg-white text-red-600' : 'bg-red-100 text-red-600'}`}>
                                {data.filter(i => i.manualAlert || (i.gap > 0 && !i.isPendingRequest && (!i.openPOs || i.openPOs.length === 0))).length}
                            </span>
                        </button>
                        <button
                            onClick={() => setFilter('requested')}
                            className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all flex items-center gap-1.5 ${filter === 'requested' ? 'bg-amber-100 text-amber-900 border border-amber-200 shadow-sm' : 'text-zinc-500 hover:text-amber-600'}`}
                        >
                            Requested
                            <span className="bg-amber-600 text-white text-[9px] px-1 rounded-full h-4 flex items-center justify-center">
                                {data.filter(i => !i.manualAlert && (i.isPendingRequest || optimisticPendingRequests.has(i.id))).length}
                            </span>
                        </button>
                        <button
                            onClick={() => setFilter('approved')}
                            className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all flex items-center gap-1.5 ${filter === 'approved' ? 'bg-blue-100 text-blue-900 border border-blue-200 shadow-sm' : 'text-zinc-500 hover:text-blue-600'}`}
                        >
                            Approved
                            <span className="bg-blue-600 text-white text-[9px] px-1 rounded-full h-4 flex items-center justify-center">
                                {data.filter(i => !i.manualAlert && ((i.openPOs && i.openPOs.length > 0) || (optimisticPOs[i.id] && optimisticPOs[i.id].length > 0))).length}
                            </span>
                        </button>
                        <button
                            onClick={() => setFilter('rejected')}
                            className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all flex items-center gap-1.5 ${filter === 'rejected' ? 'bg-red-100 text-red-900 border border-red-200 shadow-sm' : 'text-zinc-500 hover:text-red-600'}`}
                        >
                            Rejected
                            <span className="bg-red-600 text-white text-[9px] px-1 rounded-full h-4 flex items-center justify-center">
                                {data.filter(i => i.isRejectedRequest).length}
                            </span>
                        </button>
                        <button
                            onClick={() => setFilter('completed')}
                            className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all flex items-center gap-1.5 ${filter === 'completed' ? 'bg-emerald-100 text-emerald-900 border border-emerald-200 shadow-sm' : 'text-zinc-500 hover:text-emerald-600'}`}
                        >
                            Completed
                            <span className="bg-emerald-600 text-white text-[9px] px-1 rounded-full h-4 flex items-center justify-center">
                                {data.filter(i => !i.manualAlert && i.gap <= 0 && !i.isPendingRequest && (!i.openPOs || i.openPOs.length === 0)).length}
                            </span>
                        </button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
                <div className="w-full border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b-2 border-black bg-zinc-100 uppercase text-[10px] font-black tracking-wider">
                                    <th className="p-4">Material Info</th>
                                    <th className="p-4 text-center">Stock & Demand</th>
                                    <th className="p-4">Planning</th>
                                    <th className="p-4">Supply Chain</th>
                                    <th className="p-4 text-right">Financial Impact</th>
                                    <th className="p-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200">
                                {filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-zinc-400 italic font-medium">
                                            No items found for this filter.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.map((item) => (
                                        <tr key={item.id} className="group hover:bg-zinc-50 transition-colors">
                                            {/* Material Info */}
                                            <td className="p-4 align-top w-[250px]">
                                                <div className="font-black text-black">{item.name}</div>
                                                <div className="text-[10px] text-zinc-500 font-mono mt-1">
                                                    {item.category} • {item.sku}
                                                </div>
                                                <div className="flex gap-1 mt-1 flex-wrap">
                                                    {item.manualAlert && (
                                                        <Badge variant="destructive" className="text-[9px] h-4 uppercase font-black tracking-tighter">
                                                            Manual Alert
                                                        </Badge>
                                                    )}
                                                    {item.alternative && (
                                                        <Badge variant="outline" className="text-[9px] h-4 border-emerald-500 text-emerald-700 bg-emerald-50">
                                                            Alt: {item.alternative.code}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Stock & Demand (Warehouses + Work Orders) */}
                                            <td className="p-4 align-top w-[200px]">
                                                <div className="text-center">
                                                    <div className="text-xl font-black">{item.currentStock} <span className="text-sm font-normal text-zinc-500">{item.unit}</span></div>

                                                    {/* Warehouse Tooltip / Breakdown */}
                                                    {item.warehouses.length > 0 && (
                                                        <div className="flex flex-wrap justify-center gap-1 mt-1">
                                                            {item.warehouses.map(w => (
                                                                <span key={w.name} className="text-[9px] bg-zinc-100 px-1 rounded border border-zinc-200" title={w.name}>
                                                                    {w.name.substring(0, 3)}: {w.qty}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Active Demand Warning */}
                                                    {item.demandSources.length > 0 && (
                                                        <div className="mt-2 text-left bg-purple-50 p-2 rounded border border-purple-200">
                                                            <div className="text-[10px] font-bold text-purple-700 uppercase flex items-center gap-1">
                                                                <AlertCircle className="h-3 w-3" /> Needed for WO
                                                            </div>
                                                            <div className="space-y-1 mt-1">
                                                                {item.demandSources.slice(0, 2).map((wo, i) => (
                                                                    <div key={i} className="text-[9px] text-purple-800 font-mono">
                                                                        WO-{wo.number}: {wo.qty} {item.unit}
                                                                    </div>
                                                                ))}
                                                                {item.demandSources.length > 2 && <div className="text-[9px] text-center text-purple-400">+{item.demandSources.length - 2} more</div>}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Planning (Safety, ROP, Burn) */}
                                            <td className="p-4 align-top">
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                    <span className="text-zinc-500 text-[10px] uppercase font-bold">Safe Stock</span>
                                                    <span className="font-mono font-bold text-right">{item.safetyStock}</span>

                                                    <span className="text-zinc-500 text-[10px] uppercase font-bold">R. Point</span>
                                                    <span className="font-mono font-bold text-right text-amber-600">{item.reorderPoint}</span>

                                                    <span className="text-zinc-500 text-[10px] uppercase font-bold">Lead Time</span>
                                                    <span className="font-mono text-right">{item.leadTime}d</span>

                                                    <span className="text-zinc-500 text-[10px] uppercase font-bold">Burn Rate</span>
                                                    <span className="font-mono text-right">{item.consumptionRate}/d</span>
                                                </div>
                                                <div className={`mt-2 text-[10px] font-black uppercase text-center border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded p-1 ${item.stockEndsInDays < 7 ? 'bg-red-200 text-red-900' : 'bg-emerald-200 text-emerald-900'}`}>
                                                    Stock ends: {item.stockEndsInDays === 999 ? '∞' : `${item.stockEndsInDays} days`}
                                                </div>
                                            </td>

                                            {/* Supply Chain (Supplier & PO) */}
                                            <td className="p-4 align-top">
                                                <div className="text-xs space-y-2">
                                                    {/* Supplier */}
                                                    <div>
                                                        <div className="text-[9px] uppercase font-bold text-zinc-400">Preferred Vendor</div>
                                                        <div className="font-bold truncate w-[120px]">{item.supplier?.name || 'Unknown'}</div>
                                                    </div>

                                                    {/* Incoming PO */}
                                                    {/* Incoming PO - Hide if Manual Alert (User treats it as insufficient/ignored) */}
                                                    {!item.manualAlert && ((item.activePO) || (optimisticPOs[item.id] && optimisticPOs[item.id].length > 0)) && !optimisticResolvedItems.has(item.id) ? (
                                                        <div className="bg-blue-100 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] p-2 rounded relative mt-1">
                                                            <div className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[8px] font-black px-1 border border-black rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] rotate-3">
                                                                INCOMING
                                                            </div>
                                                            <div className="text-[10px] font-bold mt-1 leading-tight">
                                                                {(optimisticPOs[item.id] && optimisticPOs[item.id].length > 0) ? optimisticPOs[item.id][0].orderedQty : item.activePO?.qty} {item.unit}
                                                            </div>
                                                            <div className="text-[9px] font-mono text-blue-900">
                                                                via {(optimisticPOs[item.id] && optimisticPOs[item.id].length > 0) ? `PO-${optimisticPOs[item.id][0].number}` : `PO-${item.activePO?.number}`}
                                                            </div>
                                                            <div className="text-[9px] font-bold text-black/60 mt-0.5 border-t border-black/10 pt-0.5">
                                                                ETA: {formatDate((optimisticPOs[item.id] && optimisticPOs[item.id].length > 0) ? optimisticPOs[item.id][0].expectedDate : item.activePO?.eta)}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-[10px] text-zinc-400 italic">No active orders</div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Financial Impact */}
                                            <td className="p-4 text-right align-top">
                                                <div className="text-xs font-mono text-zinc-500">{formatCurrency(item.cost)} / {item.unit}</div>
                                                {/* Hide gap/impact if pending request exists */}
                                                {item.gap > 0 && !optimisticResolvedItems.has(item.id) && !item.isPendingRequest && !optimisticPendingRequests.has(item.id) ? (
                                                    <div className="mt-2 text-right">
                                                        <div className="text-[10px] text-zinc-400 uppercase font-bold">Budget Needed</div>
                                                        <div className="text-sm font-black text-red-600">{formatCurrency(item.totalGapCost)}</div>
                                                        <div className="text-[10px] text-red-500 font-bold">Deficit: {item.gap} {item.unit}</div>
                                                    </div>
                                                ) : (
                                                    <div className="mt-2 text-[10px] text-black font-black bg-emerald-300 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-block px-2 py-0.5 rounded rotate-[-2deg]">
                                                        HEALTHY
                                                    </div>
                                                )}
                                            </td>

                                            {/* Action */}
                                            <td className="p-4 text-right align-top">
                                                <div className="flex justify-end gap-2">
                                                    {/* Action Logic */}
                                                    {item.gap > 0 && !optimisticResolvedItems.has(item.id) ? (
                                                        // GAP EXISTS
                                                        // Priority Case: MANUAL ALERT -> Always Allow Request (Even if PO exists, it might be insufficient)
                                                        (item.manualAlert) ? (
                                                            <PurchaseRequestDialog
                                                                item={{
                                                                    id: item.id,
                                                                    name: item.name,
                                                                    sku: item.sku,
                                                                    category: item.category,
                                                                    unit: item.unit,
                                                                    cost: item.cost,
                                                                    gap: item.gap,
                                                                    reorderPoint: item.reorderPoint
                                                                }}
                                                                onSuccess={(result) => handlePurchaseSuccess(item.id, result)}
                                                            />
                                                        ) :
                                                            ((item.openPOs && item.openPOs.length > 0) || (optimisticPOs[item.id] && optimisticPOs[item.id].length > 0)) ? (
                                                                // A. Active PO -> Show Receipt Dialog
                                                                <GoodsReceiptDialog
                                                                    item={{
                                                                        id: item.id,
                                                                        name: item.name,
                                                                        unit: item.unit,
                                                                        warehouses: item.warehouses
                                                                    }}
                                                                    // Combine server POs with optimistic local POs
                                                                    openPOs={[...(item.openPOs || []), ...(optimisticPOs[item.id] || [])]}
                                                                    onSuccess={() => {
                                                                        handleReceiptSuccess(item.id)
                                                                        setOptimisticPOs(prev => {
                                                                            const newState = { ...prev };
                                                                            delete newState[item.id];
                                                                            return newState;
                                                                        })
                                                                    }}
                                                                />
                                                            ) : (
                                                                // B. No Active PO -> Check if Pending
                                                                (item.isPendingRequest || optimisticPendingRequests.has(item.id)) ? (
                                                                    // B1. Pending -> Show Badge
                                                                    <div className="flex items-center justify-end gap-2 text-amber-600 font-bold text-xs uppercase">
                                                                        <span className="bg-amber-100 px-2 py-1 rounded border border-amber-200 flex items-center gap-1">
                                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                                            Pending Request
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    // B2. Not Pending -> Show Request Dialog
                                                                    <PurchaseRequestDialog
                                                                        item={{
                                                                            id: item.id,
                                                                            name: item.name,
                                                                            sku: item.sku,
                                                                            category: item.category,
                                                                            unit: item.unit,
                                                                            cost: item.cost,
                                                                            gap: item.gap,
                                                                            reorderPoint: item.reorderPoint
                                                                        }}
                                                                        onSuccess={(result) => handlePurchaseSuccess(item.id, result)}
                                                                    />
                                                                )
                                                            )
                                                    ) : (
                                                        // NO GAP (Healthy) -> Show Badge
                                                        <div className="flex items-center justify-end gap-2 text-emerald-600 font-bold text-xs uppercase">
                                                            <span className="bg-emerald-100 px-2 py-1 rounded border border-emerald-200">
                                                                All Good
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Fallback Restock Request (if needed, kept for reference or quick link) */}
                                                    {/* 
                                                <Link href={`/procurement/requests/create?item=${item.id}&code=${item.sku}&name=${encodeURIComponent(item.name)}&qty=${item.gap > 0 ? item.gap : (item.reorderPoint - item.currentStock)}`}>
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                                        <ArrowRight className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                                */}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
