"use client"

import { useMemo } from "react"
import { AdjustmentForm } from "@/components/inventory/adjustment-form"
import {
    ArrowRightLeft, CheckCircle2, ClipboardEdit, Clock,
    Warehouse, Plus, Minus, ArrowUpDown,
} from "lucide-react"

interface AdjustmentsClientProps {
    products: any[]
    warehouses: any[]
    movements: any[]
}

export function AdjustmentsClient({ products, warehouses, movements }: AdjustmentsClientProps) {
    const filteredMovements = useMemo(() =>
        movements.filter((m: any) => ["ADJUSTMENT", "TRANSFER", "SCRAP"].includes(m.type)),
        [movements]
    )

    const totalAdj = filteredMovements.length
    const totalIn = filteredMovements.filter((m: any) => m.qty > 0 && m.type !== "TRANSFER").length
    const totalOut = filteredMovements.filter((m: any) => m.qty < 0 && m.type !== "TRANSFER").length
    const totalTransfer = filteredMovements.filter((m: any) => m.type === "TRANSFER").length

    return (
        <div className="mf-page">
            {/* COMMAND HEADER */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-emerald-400">
                    <div className="flex items-center gap-3">
                        <ClipboardEdit className="h-5 w-5 text-emerald-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">Penyesuaian Stok</h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">Kelola perubahan stok dan transfer antar gudang</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI PULSE STRIP */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-4">
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2"><ArrowUpDown className="h-4 w-4 text-zinc-400" /><span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Mutasi</span></div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">{totalAdj}</div>
                        <div className="flex items-center gap-1 mt-1.5"><span className="text-[10px] font-bold text-emerald-600">Semua penyesuaian</span></div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2"><Plus className="h-4 w-4 text-zinc-400" /><span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Stok Masuk</span></div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">{totalIn}</div>
                        <div className="flex items-center gap-1 mt-1.5"><span className="text-[10px] font-bold text-blue-600">Penambahan</span></div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
                        <div className="flex items-center gap-2 mb-2"><Minus className="h-4 w-4 text-zinc-400" /><span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Stok Keluar</span></div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-red-600">{totalOut}</div>
                        <div className="flex items-center gap-1 mt-1.5"><span className="text-[10px] font-bold text-red-600">Pengurangan</span></div>
                    </div>
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-violet-400" />
                        <div className="flex items-center gap-2 mb-2"><ArrowRightLeft className="h-4 w-4 text-zinc-400" /><span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Transfer</span></div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-violet-600">{totalTransfer}</div>
                        <div className="flex items-center gap-1 mt-1.5"><span className="text-[10px] font-bold text-violet-600">Antar gudang</span></div>
                    </div>
                </div>
            </div>

            {/* TWO-PANEL LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden h-fit">
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 px-4 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-emerald-400">
                        <ClipboardEdit className="h-4 w-4 text-emerald-600" />
                        <span className="text-xs font-black uppercase tracking-widest text-emerald-800">Buat Penyesuaian Baru</span>
                    </div>
                    <div className="p-5">
                        <AdjustmentForm products={products} warehouses={warehouses} />
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden h-fit">
                    <div className="bg-blue-50 dark:bg-blue-950/20 px-4 py-2.5 border-b-2 border-black flex items-center justify-between border-l-[5px] border-l-blue-400">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-600" />
                            <span className="text-xs font-black uppercase tracking-widest text-blue-800">Riwayat Penyesuaian</span>
                        </div>
                        <span className="text-[10px] font-black bg-blue-200 text-blue-800 border border-blue-300 px-2 py-0.5">{filteredMovements.length}</span>
                    </div>

                    <div className="divide-y divide-zinc-100">
                        {filteredMovements.length === 0 ? (
                            <div className="p-12 text-center">
                                <Clock className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ada riwayat penyesuaian</p>
                            </div>
                        ) : filteredMovements.slice(0, 10).map((move: any, idx: number) => {
                            const isIn = move.qty > 0 && move.type !== "TRANSFER"
                            const isTransfer = move.type === "TRANSFER"
                            const accentColor = isTransfer ? "bg-violet-500" : isIn ? "bg-emerald-500" : "bg-red-500"
                            const qtyColor = isTransfer ? "text-violet-700" : isIn ? "text-emerald-700" : "text-red-700"

                            return (
                                <div key={move.id} className={`relative px-4 py-3.5 hover:bg-zinc-50 transition-colors ${idx % 2 === 1 ? "bg-zinc-50/50" : ""}`}>
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />
                                    <div className="flex justify-between items-start pl-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-black text-sm uppercase tracking-tight text-zinc-900 truncate">
                                                {move.item}
                                                <span className="text-zinc-400 text-[10px] font-mono ml-2">{move.code}</span>
                                            </div>
                                            <div className="text-[10px] font-bold text-zinc-400 mt-1 flex items-center gap-1.5">
                                                <Warehouse className="h-3 w-3" />
                                                {move.warehouse}
                                                {isTransfer && (
                                                    <>
                                                        <ArrowRightLeft className="h-3 w-3 text-violet-500" />
                                                        <span className="text-violet-600 font-black">{move.entity}</span>
                                                    </>
                                                )}
                                            </div>
                                            <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                                                {new Date(move.date).toLocaleDateString("id-ID")} • {new Date(move.date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={`text-xl font-black font-mono ${qtyColor}`}>
                                                {move.qty > 0 ? "+" : ""}{move.qty}
                                            </span>
                                            <span className="inline-block bg-black text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
                                                <CheckCircle2 className="h-3 w-3 inline mr-1" />Done
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
