"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Package, LayoutGrid, List } from "lucide-react"
import { FabricRollCard } from "./fabric-roll-card"
import { FabricRollReceiveDialog } from "./fabric-roll-receive-dialog"
import type { FabricRollSummary } from "@/lib/actions/fabric-rolls"

interface FabricRollListProps {
    rolls: FabricRollSummary[]
    products: { id: string; name: string; code: string }[]
    warehouses: { id: string; name: string; code: string }[]
}

const STATUS_FILTERS = [
    { value: '', label: 'Semua' },
    { value: 'AVAILABLE', label: 'Tersedia' },
    { value: 'RESERVED', label: 'Dipesan' },
    { value: 'IN_USE', label: 'Dipakai' },
    { value: 'DEPLETED', label: 'Habis' },
]

export function FabricRollList({ rolls, products, warehouses }: FabricRollListProps) {
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("")
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

    const filtered = rolls.filter((r) => {
        if (statusFilter && r.status !== statusFilter) return false
        if (search) {
            const q = search.toLowerCase()
            return (
                r.rollNumber.toLowerCase().includes(q) ||
                r.productName.toLowerCase().includes(q) ||
                r.productCode.toLowerCase().includes(q) ||
                (r.dyeLot?.toLowerCase().includes(q) ?? false)
            )
        }
        return true
    })

    // Summary stats
    const totalRolls = rolls.length
    const availableRolls = rolls.filter((r) => r.status === 'AVAILABLE').length
    const totalMeters = rolls.reduce((s, r) => s + r.remainingMeters, 0)

    return (
        <div className="space-y-4">
            {/* Summary Strip */}
            <div className="grid grid-cols-3 gap-4">
                <div className="border border-border p-3 bg-white shadow-sm">
                    <span className="text-xs font-semibold text-zinc-400 block">Total Roll</span>
                    <span className="text-2xl font-semibold">{totalRolls}</span>
                </div>
                <div className="border border-border p-3 bg-white shadow-sm">
                    <span className="text-xs font-semibold text-zinc-400 block">Tersedia</span>
                    <span className="text-2xl font-semibold text-emerald-600">{availableRolls}</span>
                </div>
                <div className="border border-border p-3 bg-white shadow-sm">
                    <span className="text-xs font-semibold text-zinc-400 block">Total Sisa Meter</span>
                    <span className="text-2xl font-semibold">{totalMeters.toLocaleString('id-ID', { maximumFractionDigits: 1 })}m</span>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                        className="pl-9 border border-border font-bold h-9 rounded-md"
                        placeholder="Cari roll, produk, lot..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex gap-1">
                    {STATUS_FILTERS.map((f) => (
                        <Button
                            key={f.value}
                            variant="outline"
                            size="sm"
                            className={`h-9 text-xs font-semibold   border border-border rounded-md ${
                                statusFilter === f.value ? 'bg-slate-900 text-white' : 'bg-white hover:bg-zinc-100'
                            }`}
                            onClick={() => setStatusFilter(f.value)}
                        >
                            {f.label}
                        </Button>
                    ))}
                </div>

                <div className="flex gap-1 ml-auto">
                    <Button
                        variant="outline"
                        size="sm"
                        className={`h-9 w-9 p-0 border border-border rounded-md ${viewMode === 'grid' ? 'bg-slate-900 text-white' : ''}`}
                        onClick={() => setViewMode('grid')}
                    >
                        <LayoutGrid className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className={`h-9 w-9 p-0 border border-border rounded-md ${viewMode === 'table' ? 'bg-slate-900 text-white' : ''}`}
                        onClick={() => setViewMode('table')}
                    >
                        <List className="h-3.5 w-3.5" />
                    </Button>
                </div>

                <FabricRollReceiveDialog products={products} warehouses={warehouses} />
            </div>

            {/* Content */}
            {filtered.length === 0 ? (
                <div className="border border-dashed border-zinc-300 p-12 text-center">
                    <Package className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
                    <span className="text-xs font-semibold text-zinc-400 block">
                        {search || statusFilter ? 'Tidak ada roll yang cocok' : 'Belum ada fabric roll'}
                    </span>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filtered.map((roll) => (
                        <FabricRollCard key={roll.id} roll={roll} />
                    ))}
                </div>
            ) : (
                <div className="border border-border overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-zinc-100 border-b border-border">
                            <tr>
                                <th className="text-xs font-semibold text-zinc-500 px-3 py-2 text-left">Roll #</th>
                                <th className="text-xs font-semibold text-zinc-500 px-3 py-2 text-left">Produk</th>
                                <th className="text-xs font-semibold text-zinc-500 px-3 py-2 text-center">Sisa</th>
                                <th className="text-xs font-semibold text-zinc-500 px-3 py-2 text-center">Dye Lot</th>
                                <th className="text-xs font-semibold text-zinc-500 px-3 py-2 text-center">Grade</th>
                                <th className="text-xs font-semibold text-zinc-500 px-3 py-2 text-left">Gudang</th>
                                <th className="text-xs font-semibold text-zinc-500 px-3 py-2 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((r) => {
                                const style = {
                                    AVAILABLE: 'bg-emerald-100 text-emerald-700',
                                    RESERVED: 'bg-blue-100 text-blue-700',
                                    IN_USE: 'bg-amber-100 text-amber-700',
                                    DEPLETED: 'bg-zinc-100 text-zinc-500',
                                }[r.status] ?? ''
                                return (
                                    <tr key={r.id} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50">
                                        <td className="px-3 py-2 font-mono font-semibold text-xs">{r.rollNumber}</td>
                                        <td className="px-3 py-2">
                                            <div className="text-xs font-bold">{r.productName}</div>
                                            <div className="text-xs text-zinc-400 font-mono">{r.productCode}</div>
                                        </td>
                                        <td className="px-3 py-2 text-center font-mono font-bold text-xs">
                                            {r.remainingMeters}m / {r.lengthMeters}m
                                        </td>
                                        <td className="px-3 py-2 text-center text-xs">{r.dyeLot ?? '—'}</td>
                                        <td className="px-3 py-2 text-center text-xs font-bold">{r.grade ?? '—'}</td>
                                        <td className="px-3 py-2 text-xs">{r.warehouseName}</td>
                                        <td className="px-3 py-2 text-center">
                                            <span className={`text-xs font-semibold px-1.5 py-0.5 border ${style}`}>
                                                {r.status}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
