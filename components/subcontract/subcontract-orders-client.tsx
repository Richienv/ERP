"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ClipboardList, Plus, Search, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SubcontractOrderForm } from "./subcontract-order-form"
import {
    subcontractStatusLabels,
    subcontractStatusColors,
} from "@/lib/subcontract-state-machine"
import type { SubcontractOrderSummary, SubcontractorSummary } from "@/lib/actions/subcontract"
import type { SubcontractOrderStatus } from "@prisma/client"

const ALL_STATUSES: SubcontractOrderStatus[] = [
    "SC_DRAFT",
    "SC_SENT",
    "SC_IN_PROGRESS",
    "SC_PARTIAL_COMPLETE",
    "SC_COMPLETED",
    "SC_CANCELLED",
]

interface SubcontractOrdersClientProps {
    orders: SubcontractOrderSummary[]
    subcontractors: SubcontractorSummary[]
    products: { id: string; name: string; code: string }[]
}

export function SubcontractOrdersClient({
    orders,
    subcontractors,
    products,
}: SubcontractOrdersClientProps) {
    const router = useRouter()
    const [showCreate, setShowCreate] = useState(false)
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("")
    const [subFilter, setSubFilter] = useState<string>("")

    const filtered = useMemo(() => {
        let result = orders
        if (search) {
            const q = search.toLowerCase()
            result = result.filter(
                (o) =>
                    o.number.toLowerCase().includes(q) ||
                    o.subcontractorName.toLowerCase().includes(q)
            )
        }
        if (statusFilter) {
            result = result.filter((o) => o.status === statusFilter)
        }
        if (subFilter) {
            result = result.filter((o) => {
                const sub = subcontractors.find((s) => s.id === subFilter)
                return sub && o.subcontractorName === sub.name
            })
        }
        return result
    }, [orders, search, statusFilter, subFilter, subcontractors])

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    <h2 className="text-sm font-black uppercase tracking-widest">
                        Daftar Order Subkontrak
                    </h2>
                    <span className="text-[9px] font-black px-2 py-0.5 bg-zinc-100 border-2 border-black">
                        {filtered.length}
                    </span>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-1.5 bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-[10px] tracking-wider px-4 h-8 rounded-none"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Buat Order
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                    <Input
                        className="border-2 border-black rounded-none h-8 pl-8 text-xs font-bold"
                        placeholder="Cari no. order / subkontraktor..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="border-2 border-black rounded-none h-8 px-2 text-[10px] font-black uppercase tracking-wider bg-white"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="">Semua Status</option>
                    {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                            {subcontractStatusLabels[s]}
                        </option>
                    ))}
                </select>
                <select
                    className="border-2 border-black rounded-none h-8 px-2 text-[10px] font-black uppercase tracking-wider bg-white"
                    value={subFilter}
                    onChange={(e) => setSubFilter(e.target.value)}
                >
                    <option value="">Semua Mitra</option>
                    {subcontractors
                        .filter((s) => s.isActive)
                        .map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                </select>
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
                <div className="bg-white border-2 border-black p-8 text-center">
                    <ClipboardList className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        {orders.length === 0
                            ? "Belum ada order subkontrak"
                            : "Tidak ada hasil yang cocok"}
                    </span>
                </div>
            ) : (
                <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-zinc-100 border-b-2 border-black">
                            <tr>
                                <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">
                                    No. Order
                                </th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">
                                    Subkontraktor
                                </th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">
                                    Operasi
                                </th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-center">
                                    Status
                                </th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-right">
                                    Kirim
                                </th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-right">
                                    Kembali
                                </th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">
                                    Tanggal
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((o) => (
                                <tr
                                    key={o.id}
                                    className="border-b border-zinc-200 last:border-b-0 hover:bg-zinc-50 cursor-pointer transition-colors"
                                    onClick={() =>
                                        router.push(`/subcontract/orders/${o.id}`)
                                    }
                                >
                                    <td className="px-3 py-2 text-xs font-black">
                                        {o.number}
                                    </td>
                                    <td className="px-3 py-2 text-xs font-bold">
                                        {o.subcontractorName}
                                    </td>
                                    <td className="px-3 py-2 text-xs font-bold">
                                        {o.operation}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <span
                                            className={`text-[8px] font-black px-1.5 py-0.5 border ${subcontractStatusColors[o.status]}`}
                                        >
                                            {subcontractStatusLabels[o.status]}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs font-mono text-right">
                                        {o.totalIssuedQty.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-xs font-mono text-right">
                                        {o.totalReturnedQty.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-[10px] text-zinc-500 font-bold">
                                        {new Date(o.issuedDate).toLocaleDateString(
                                            "id-ID"
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <SubcontractOrderForm
                open={showCreate}
                onOpenChange={setShowCreate}
                subcontractors={subcontractors}
                products={products}
            />
        </div>
    )
}
