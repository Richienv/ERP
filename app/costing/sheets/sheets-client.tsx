"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import Link from "next/link"
import {
    DollarSign,
    Plus,
    Search,
    Copy,
    ArrowLeft,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { CostSheetForm } from "@/components/costing/cost-sheet-form"
import { costSheetStatusLabels, costSheetStatusColors } from "@/lib/costing-calculations"
import type { CostSheetStatusType } from "@/lib/costing-calculations"
import { duplicateCostSheet } from "@/lib/actions/costing"
import type { CostSheetSummary } from "@/lib/actions/costing"
import { toast } from "sonner"

const formatIDR = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)

interface Props {
    initialSheets: CostSheetSummary[]
    products: { id: string; name: string; code: string }[]
}

export function SheetsClient({ initialSheets, products }: Props) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [createOpen, setCreateOpen] = useState(false)
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [duplicating, setDuplicating] = useState<string | null>(null)

    const filtered = useMemo(() => {
        return initialSheets.filter((s) => {
            const kw = search.toLowerCase()
            const matchSearch = !kw ||
                s.productName.toLowerCase().includes(kw) ||
                s.productCode.toLowerCase().includes(kw) ||
                s.number.toLowerCase().includes(kw)
            const matchStatus = statusFilter === "all" || s.status === statusFilter
            return matchSearch && matchStatus
        })
    }, [initialSheets, search, statusFilter])

    const handleDuplicate = async (e: React.MouseEvent, sheetId: string) => {
        e.stopPropagation()
        e.preventDefault()
        setDuplicating(sheetId)
        const result = await duplicateCostSheet(sheetId)
        setDuplicating(null)
        if (result.success && result.newId) {
            toast.success("Cost sheet berhasil diduplikasi")
            queryClient.invalidateQueries({ queryKey: queryKeys.costSheets.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.costingDashboard.all })
            router.push(`/costing/sheets/${result.newId}`)
        } else {
            toast.error(result.error || "Gagal menduplikasi")
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <Link
                        href="/costing"
                        className="p-2 border-2 border-black hover:bg-zinc-100 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black uppercase tracking-wider">
                                Daftar Cost Sheet
                            </h1>
                            <span className="text-[9px] font-black px-2 py-0.5 bg-zinc-100 border-2 border-black">
                                {initialSheets.length}
                            </span>
                        </div>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                            Kalkulasi biaya per produk garmen
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 border-2 border-black bg-black text-white font-black uppercase text-[10px] tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Buat Cost Sheet
                </button>
            </div>

            {/* Filter Bar */}
            <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <div className="flex-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">
                            Cari
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                            <Input
                                placeholder="Nama produk, kode, nomor sheet..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 border-2 border-black font-bold h-9 rounded-none"
                            />
                        </div>
                    </div>
                    <div className="min-w-[160px]">
                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">
                            Status
                        </label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="border-2 border-black font-bold h-9 rounded-none">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Status</SelectItem>
                                <SelectItem value="CS_DRAFT">Draft</SelectItem>
                                <SelectItem value="CS_FINALIZED">Final</SelectItem>
                                <SelectItem value="CS_APPROVED">Disetujui</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
                <div className="bg-white border-2 border-black p-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <DollarSign className="h-8 w-8 mx-auto text-zinc-200 mb-2" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        {search || statusFilter !== "all" ? "Tidak ada hasil yang cocok" : "Belum ada cost sheet"}
                    </span>
                </div>
            ) : (
                <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-zinc-100 border-b-2 border-black">
                                <tr>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">No.</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">Produk</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-center">Versi</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-center">Status</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-right">Total Biaya</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-right">Target Harga</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-right">Margin</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((s) => {
                                    const margin = s.targetPrice && s.totalCost > 0
                                        ? Math.round(((s.targetPrice - s.totalCost) / s.targetPrice) * 100)
                                        : null
                                    return (
                                        <tr
                                            key={s.id}
                                            className="border-b border-zinc-200 last:border-b-0 hover:bg-zinc-50 cursor-pointer transition-colors"
                                            onClick={() => router.push(`/costing/sheets/${s.id}`)}
                                        >
                                            <td className="px-3 py-2.5 text-xs font-black">{s.number}</td>
                                            <td className="px-3 py-2.5">
                                                <div className="text-xs font-bold">{s.productName}</div>
                                                <div className="text-[9px] text-zinc-400 font-mono">{s.productCode}</div>
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-xs font-bold">v{s.version}</td>
                                            <td className="px-3 py-2.5 text-center">
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 border ${costSheetStatusColors[s.status as CostSheetStatusType]}`}>
                                                    {costSheetStatusLabels[s.status as CostSheetStatusType]}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-xs font-mono text-right font-bold">
                                                {formatIDR(s.totalCost)}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs font-mono text-right">
                                                {s.targetPrice ? formatIDR(s.targetPrice) : "—"}
                                            </td>
                                            <td className={`px-3 py-2.5 text-xs font-bold text-right ${margin !== null ? (margin >= 20 ? "text-emerald-600" : "text-red-600") : ""}`}>
                                                {margin !== null ? `${margin}%` : "—"}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <button
                                                    onClick={(e) => handleDuplicate(e, s.id)}
                                                    disabled={duplicating === s.id}
                                                    className="p-1.5 border border-zinc-300 hover:border-black hover:bg-zinc-100 transition-colors"
                                                    title="Duplikasi"
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <CostSheetForm
                open={createOpen}
                onOpenChange={setCreateOpen}
                products={products}
            />
        </div>
    )
}
