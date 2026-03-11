"use client"

import { useState, useMemo } from "react"
import { useMaterialDemand, type MaterialDemandRow } from "@/hooks/use-material-demand"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { IconPackages, IconBox, IconTruckDelivery, IconAlertTriangle, IconSearch } from "@tabler/icons-react"
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

export const dynamic = "force-dynamic"

const statusConfig = {
    Cukup: { color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300", label: "Cukup" },
    "Perlu Pesan": { color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300", label: "Perlu Pesan" },
    Kurang: { color: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300", label: "Kurang" },
}

function formatNumber(n: number): string {
    return n.toLocaleString("id-ID")
}

export default function MaterialDemandPage() {
    const { data, isLoading } = useMaterialDemand()
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")

    const filteredRows = useMemo(() => {
        if (!data?.rows) return []
        let rows = data.rows
        if (search) {
            const q = search.toLowerCase()
            rows = rows.filter(
                (r) =>
                    r.materialCode.toLowerCase().includes(q) ||
                    r.materialName.toLowerCase().includes(q)
            )
        }
        if (statusFilter !== "all") {
            rows = rows.filter((r) => r.status === statusFilter)
        }
        return rows
    }, [data?.rows, search, statusFilter])

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-orange-400" />

    const kpi = data.kpi ?? { totalMaterials: 0, materialsInStock: 0, materialsOnOrder: 0, shortfallCount: 0 }

    const kpis = [
        {
            label: "Total Material",
            value: kpi.totalMaterials,
            icon: IconPackages,
            accent: "border-l-indigo-500",
            bg: "bg-indigo-50 dark:bg-indigo-950/20",
        },
        {
            label: "Stok Cukup",
            value: kpi.materialsInStock,
            icon: IconBox,
            accent: "border-l-emerald-500",
            bg: "bg-emerald-50 dark:bg-emerald-950/20",
        },
        {
            label: "Dalam Pesanan",
            value: kpi.materialsOnOrder,
            icon: IconTruckDelivery,
            accent: "border-l-amber-500",
            bg: "bg-amber-50 dark:bg-amber-950/20",
        },
        {
            label: "Kekurangan",
            value: kpi.shortfallCount,
            icon: IconAlertTriangle,
            accent: "border-l-red-500",
            bg: "bg-red-50 dark:bg-red-950/20",
        },
    ]

    return (
        <div className="mf-page">
            {/* Header */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="px-6 py-4 border-l-[6px] border-l-orange-500">
                    <h1 className="text-lg font-black tracking-tight">Kebutuhan Material</h1>
                    <p className="text-xs text-zinc-500 mt-0.5">
                        Analisis kebutuhan material dari semua Work Order aktif (PLANNED & IN_PROGRESS)
                    </p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {kpis.map((k) => {
                    const Icon = k.icon
                    return (
                        <div
                            key={k.label}
                            className={`border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${k.bg} overflow-hidden`}
                        >
                            <div className={`px-4 py-3 border-l-[5px] ${k.accent}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                            {k.label}
                                        </p>
                                        <p className="text-2xl font-black mt-0.5">{formatNumber(k.value)}</p>
                                    </div>
                                    <Icon className="h-8 w-8 text-zinc-300" stroke={1.5} />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Filter bar */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 px-4 py-3">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <div className="relative flex-1 max-w-lg">
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            placeholder="Cari material..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 border-2 border-black placeholder:text-zinc-300"
                        />
                    </div>
                    <div className="flex gap-1.5">
                        {[
                            { key: "all", label: "Semua" },
                            { key: "Kurang", label: "Kurang" },
                            { key: "Perlu Pesan", label: "Perlu Pesan" },
                            { key: "Cukup", label: "Cukup" },
                        ].map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setStatusFilter(f.key)}
                                className={`px-3 py-1.5 text-xs font-bold border-2 border-black transition-colors ${
                                    statusFilter === f.key
                                        ? "bg-black text-white"
                                        : "bg-white text-black hover:bg-zinc-100 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b-2 border-black bg-zinc-50 dark:bg-zinc-800/50">
                                <TableHead className="font-black text-[10px] uppercase tracking-widest">Kode</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-widest">Nama Material</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-widest">Satuan</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-widest text-right">Dibutuhkan</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-widest text-right">Stok</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-widest text-right">Dalam Pesanan</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-widest text-right">Kekurangan</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-widest">Status</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-widest">Work Order</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-12 text-zinc-400">
                                        {(data.rows?.length ?? 0) === 0
                                            ? "Belum ada Work Order aktif dengan BOM"
                                            : "Tidak ada material yang cocok dengan filter"}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredRows.map((row) => (
                                    <MaterialDemandTableRow key={row.materialId} row={row} />
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}

function MaterialDemandTableRow({ row }: { row: MaterialDemandRow }) {
    const cfg = statusConfig[row.status] ?? statusConfig["Kurang"]
    const woNumbers = row.workOrderNumbers ?? []
    return (
        <TableRow className="border-b border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
            <TableCell className="font-mono text-xs font-bold">{row.materialCode || "—"}</TableCell>
            <TableCell className="text-sm font-medium">{row.materialName || "—"}</TableCell>
            <TableCell className="text-xs text-zinc-500">{row.unit || "—"}</TableCell>
            <TableCell className="text-right font-mono text-sm font-bold">{formatNumber(row.requiredQty ?? 0)}</TableCell>
            <TableCell className="text-right font-mono text-sm">{formatNumber(row.inStock ?? 0)}</TableCell>
            <TableCell className="text-right font-mono text-sm">{formatNumber(row.onOrder ?? 0)}</TableCell>
            <TableCell className="text-right font-mono text-sm font-bold">
                {(row.shortfall ?? 0) > 0 ? (
                    <span className="text-red-600 dark:text-red-400">{formatNumber(row.shortfall)}</span>
                ) : (
                    <span className="text-zinc-400">0</span>
                )}
            </TableCell>
            <TableCell>
                <Badge variant="outline" className={`text-[10px] font-bold border ${cfg.color}`}>
                    {cfg.label}
                </Badge>
            </TableCell>
            <TableCell>
                <div className="flex flex-wrap gap-1">
                    {woNumbers.slice(0, 3).map((wo) => (
                        <span
                            key={wo}
                            className="inline-block px-1.5 py-0.5 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded"
                        >
                            {wo}
                        </span>
                    ))}
                    {woNumbers.length > 3 && (
                        <span className="text-[10px] text-zinc-400">
                            +{woNumbers.length - 3}
                        </span>
                    )}
                </div>
            </TableCell>
        </TableRow>
    )
}
