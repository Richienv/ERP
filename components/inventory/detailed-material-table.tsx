"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Package, TrendingUp, TrendingDown, AlertCircle, ShoppingCart, Plus, ArrowRight } from "lucide-react"
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
        name: string
        qty: number
    }[]
    alternative: {
        name: string
        code: string
    } | null
}

export function DetailedMaterialTable({ data }: { data: GapData[] }) {
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
                            Material Gap Analysis (Advanced)
                        </CardTitle>
                        <p className="text-sm text-muted-foreground font-bold mt-1">Real-time Safety Stock, Reorder Points, and Procurement Gaps.</p>
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
                                {data.map((item) => (
                                    <tr key={item.id} className="group hover:bg-zinc-50 transition-colors">
                                        {/* Material Info */}
                                        <td className="p-4 align-top w-[250px]">
                                            <div className="font-black text-black">{item.name}</div>
                                            <div className="text-[10px] text-zinc-500 font-mono mt-1">
                                                {item.category} • {item.sku}
                                            </div>
                                            {item.alternative && (
                                                <Badge variant="outline" className="mt-1 text-[9px] h-4 border-emerald-500 text-emerald-700 bg-emerald-50">
                                                    Alt: {item.alternative.code}
                                                </Badge>
                                            )}
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
                                            <div className={`mt-2 text-[10px] font-bold text-center border rounded px-1 py-0.5 ${item.stockEndsInDays < 7 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                                                Stock ends in {item.stockEndsInDays === 999 ? '∞' : item.stockEndsInDays} days
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
                                                {item.activePO ? (
                                                    <div className="bg-blue-50 border border-blue-200 p-1.5 rounded">
                                                        <div className="text-[9px] text-blue-600 font-bold flex items-center gap-1">
                                                            <TrendingUp className="h-3 w-3" /> Incoming
                                                        </div>
                                                        <div className="text-[10px] font-mono mt-0.5">
                                                            {item.activePO.qty} {item.unit} via PO-{item.activePO.number}
                                                        </div>
                                                        <div className="text-[9px] text-blue-400 mt-0.5">
                                                            ETA: {formatDate(item.activePO.eta)}
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
                                            {item.gap > 0 ? (
                                                <div className="mt-2 text-right">
                                                    <div className="text-[10px] text-zinc-400 uppercase font-bold">Budget Needed</div>
                                                    <div className="text-sm font-black text-red-600">{formatCurrency(item.totalGapCost)}</div>
                                                    <div className="text-[10px] text-red-500 font-bold">Deficit: {item.gap} {item.unit}</div>
                                                </div>
                                            ) : (
                                                <div className="mt-2 text-[10px] text-emerald-600 font-bold bg-emerald-50 inline-block px-2 py-1 rounded-full">
                                                    Healthy
                                                </div>
                                            )}
                                        </td>

                                        {/* Action */}
                                        <td className="p-4 text-right align-top">
                                            <Link href={`/procurement/requests/create?item=${item.id}&code=${item.sku}&name=${encodeURIComponent(item.name)}&qty=${item.gap > 0 ? item.gap : (item.reorderPoint - item.currentStock)}`}>
                                                <Button size="sm" className={`
                                                    border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none font-bold uppercase text-xs h-8
                                                    ${item.gap > 0
                                                        ? "bg-black text-white hover:bg-zinc-800"
                                                        : "bg-white text-black hover:bg-zinc-100"}
                                                `}>
                                                    {item.gap > 0 ? "Restock" : "Add Stock"}
                                                </Button>
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
