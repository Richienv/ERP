"use client"

import { Clock } from "lucide-react"
import { formatIDR } from "@/lib/utils"

// ── Shared row type for both AR and AP riwayat tables ──
export interface PaymentHistoryRow {
    id: string
    documentNumber: string      // Invoice # (AR) or Bill # (AP)
    counterpartyName: string    // Customer (AR) or Vendor (AP)
    method: string              // TRANSFER, CASH, CHECK, GIRO, CARD
    methodLabel?: string        // Optional display label (e.g. "Transfer" instead of "TRANSFER")
    reference: string | null
    amount: number
    date: Date | string
    status?: "PAID" | "PARTIAL" | string
}

interface PaymentHistoryTableProps {
    title: string                                   // "Riwayat Terakhir" (AR) or "Riwayat Pembayaran" (AP)
    rows: PaymentHistoryRow[]
    documentLabel: string                           // "Invoice" (AR) or "No. Bill" (AP)
    counterpartyLabel: string                       // "Pelanggan" (AR) or "Vendor" (AP)
    onRowClick?: (row: PaymentHistoryRow) => void
    maxHeight?: number                              // default 200
}

const METHOD_BADGE_STYLE: Record<string, string> = {
    TRANSFER: "border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20",
    CASH: "border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20",
    CHECK: "border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
    GIRO: "border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
}
const METHOD_BADGE_DEFAULT = "border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/30"

function getStatusBadge(status?: string) {
    if (!status) return null
    if (status === "PAID") return { label: "Lunas", cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" }
    if (status === "PARTIAL") return { label: "Sebagian", cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" }
    return { label: status, cls: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400" }
}

export function PaymentHistoryTable({
    title,
    rows,
    documentLabel,
    counterpartyLabel,
    onRowClick,
    maxHeight = 200,
}: PaymentHistoryTableProps) {
    if (rows.length === 0) return null

    const total = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0)

    return (
        <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
            {/* Header bar */}
            <div className="px-4 py-2 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{title}</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5">
                    {rows.length}
                </span>
            </div>

            {/* Table header */}
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-1.5 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-800/30">
                <div className="col-span-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">{documentLabel}</div>
                <div className="col-span-3 text-[9px] font-black uppercase tracking-widest text-zinc-400">{counterpartyLabel}</div>
                <div className="col-span-1 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-center">Metode</div>
                <div className="col-span-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">Referensi</div>
                <div className="col-span-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Jumlah</div>
                <div className="col-span-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Tanggal</div>
            </div>

            {/* Table rows */}
            <div className="overflow-auto" style={{ maxHeight }}>
                {rows.map((row, idx) => {
                    const badge = getStatusBadge(row.status)
                    return (
                        <button
                            key={row.id}
                            type="button"
                            onClick={() => onRowClick?.(row)}
                            className={`group w-full grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 items-center text-left transition-all duration-150 ${
                                idx % 2 === 1 ? "bg-zinc-50/40 dark:bg-zinc-800/20" : ""
                            } hover:bg-orange-50/40 dark:hover:bg-orange-950/15 hover:border-l-4 hover:border-l-orange-400 hover:pl-3 ${
                                onRowClick ? "cursor-pointer" : "cursor-default"
                            }`}
                        >
                            {/* Document # */}
                            <div className="col-span-2 min-w-0">
                                <span className="font-mono text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate block">
                                    {row.documentNumber}
                                </span>
                            </div>

                            {/* Counterparty */}
                            <div className="col-span-3 min-w-0">
                                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 truncate block">
                                    {row.counterpartyName}
                                </span>
                            </div>

                            {/* Method badge */}
                            <div className="col-span-1 flex justify-center">
                                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border text-center whitespace-nowrap ${
                                    METHOD_BADGE_STYLE[row.method] ?? METHOD_BADGE_DEFAULT
                                }`}>
                                    {row.methodLabel ?? row.method}
                                </span>
                            </div>

                            {/* Reference */}
                            <div className="col-span-2 min-w-0">
                                <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 truncate block">
                                    {row.reference || "—"}
                                </span>
                            </div>

                            {/* Amount */}
                            <div className="col-span-2 text-right">
                                <span className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">
                                    {formatIDR(row.amount)}
                                </span>
                            </div>

                            {/* Date + Status */}
                            <div className="col-span-2 flex items-center justify-end gap-2">
                                <span className="text-[10px] font-bold text-zinc-400 whitespace-nowrap">
                                    {new Date(row.date).toLocaleDateString("id-ID")}
                                </span>
                                {badge && (
                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 ${badge.cls}`}>
                                        {badge.label}
                                    </span>
                                )}
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* Summary footer */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700">
                <div className="col-span-8 text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center">
                    Total {rows.length} pembayaran
                </div>
                <div className="col-span-2 text-right">
                    <span className="font-mono font-black text-xs text-zinc-800 dark:text-zinc-100">
                        {formatIDR(total)}
                    </span>
                </div>
                <div className="col-span-2" />
            </div>
        </div>
    )
}
