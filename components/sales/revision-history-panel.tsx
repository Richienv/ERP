"use client"

import { useState } from "react"
import { History, ChevronDown, ChevronUp, ArrowRight, Clock, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { RevisionHistoryEntry } from "@/lib/actions/order-amendments"

const formatIDR = (value: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value)

interface RevisionHistoryPanelProps {
    currentRevision: number
    history: RevisionHistoryEntry[]
    documentType?: "SO" | "PO"
}

function DiffBadge({ oldVal, newVal, format }: { oldVal: number; newVal: number; format?: (v: number) => string }) {
    const fmt = format || ((v) => String(v))
    if (oldVal === newVal) return <span className="text-zinc-400 text-xs font-mono">{fmt(oldVal)}</span>
    return (
        <span className="inline-flex items-center gap-1 text-xs font-mono">
            <span className="text-red-500 line-through">{fmt(oldVal)}</span>
            <ArrowRight className="h-3 w-3 text-zinc-400" />
            <span className="text-emerald-600 font-bold">{fmt(newVal)}</span>
        </span>
    )
}

function RevisionCard({
    entry,
    nextEntry,
    isLatest,
    documentType,
}: {
    entry: RevisionHistoryEntry
    nextEntry?: RevisionHistoryEntry
    isLatest: boolean
    documentType: string
}) {
    const [expanded, setExpanded] = useState(false)

    const nextSnapshot = nextEntry?.snapshot
    const currentSnapshot = entry.snapshot

    return (
        <div className="border-2 border-black bg-white">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <Badge
                        variant="outline"
                        className="text-[10px] font-black uppercase tracking-wider border-2 border-black rounded-none px-2 py-0.5 bg-zinc-100"
                    >
                        Rev.{entry.revision}
                    </Badge>
                    <div className="text-left">
                        <p className="text-xs font-bold text-zinc-700">{entry.reason}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(entry.changedAt).toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {entry.changedByEmail}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-black">{formatIDR(currentSnapshot.total)}</span>
                    {expanded ? (
                        <ChevronUp className="h-4 w-4 text-zinc-400" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-zinc-400" />
                    )}
                </div>
            </button>

            {/* Expanded detail */}
            {expanded && (
                <div className="border-t-2 border-black px-4 py-3 bg-zinc-50/50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                        Snapshot Sebelum Revisi
                    </p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-zinc-200">
                                    <th className="text-left py-1.5 font-black uppercase text-[10px] text-zinc-500">
                                        Produk
                                    </th>
                                    <th className="text-right py-1.5 font-black uppercase text-[10px] text-zinc-500">
                                        Qty
                                    </th>
                                    <th className="text-right py-1.5 font-black uppercase text-[10px] text-zinc-500">
                                        Harga
                                    </th>
                                    <th className="text-right py-1.5 font-black uppercase text-[10px] text-zinc-500">
                                        Total
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {currentSnapshot.items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="py-1.5">
                                            <span className="font-bold">{item.productName}</span>
                                            <span className="text-zinc-400 font-mono ml-1 text-[10px]">
                                                {item.productCode}
                                            </span>
                                        </td>
                                        <td className="py-1.5 text-right font-mono">{item.quantity}</td>
                                        <td className="py-1.5 text-right font-mono">{formatIDR(item.unitPrice)}</td>
                                        <td className="py-1.5 text-right font-black">{formatIDR(item.lineTotal)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-black">
                                    <td colSpan={3} className="py-1.5 text-right font-black text-[10px] uppercase">
                                        Total
                                    </td>
                                    <td className="py-1.5 text-right font-black">{formatIDR(currentSnapshot.total)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

export function RevisionHistoryPanel({ currentRevision, history, documentType = "SO" }: RevisionHistoryPanelProps) {
    if (currentRevision === 0 && history.length === 0) return null

    return (
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
            <div className="px-6 py-3 border-b-2 border-black bg-zinc-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-zinc-500" />
                    <span className="text-xs font-black uppercase tracking-widest text-zinc-500">
                        Riwayat Revisi
                    </span>
                </div>
                <Badge
                    variant="outline"
                    className="text-[10px] font-black uppercase tracking-wider border-2 border-black rounded-none px-2 py-0.5"
                >
                    Rev.{currentRevision} (Saat Ini)
                </Badge>
            </div>

            <div className="p-4 space-y-2">
                {history.length === 0 ? (
                    <p className="text-xs text-zinc-400 font-medium text-center py-4">
                        Dokumen ini telah direvisi {currentRevision} kali, tetapi riwayat detail tidak tersedia.
                    </p>
                ) : (
                    [...history].reverse().map((entry, idx) => (
                        <RevisionCard
                            key={idx}
                            entry={entry}
                            nextEntry={history[history.length - 1 - idx + 1]}
                            isLatest={idx === 0}
                            documentType={documentType}
                        />
                    ))
                )}
            </div>
        </div>
    )
}
