"use client"

import Link from "next/link"
import { Warehouse, Package, ArrowRight } from "lucide-react"

interface WarehouseData {
    name: string
    code: string
    value: number
    itemCount: number
    productCount: number
}

interface WarehouseOverviewProps {
    warehouses: WarehouseData[]
}

function formatCompact(value: number): string {
    if (value === 0) return "Rp 0"
    const abs = Math.abs(value)
    if (abs >= 1_000_000_000) return `Rp ${(abs / 1_000_000_000).toFixed(1)}M`
    if (abs >= 1_000_000) return `Rp ${(abs / 1_000_000).toFixed(1)}jt`
    if (abs >= 1_000) return `Rp ${(abs / 1_000).toFixed(0)}rb`
    return `Rp ${abs.toFixed(0)}`
}

export function WarehouseOverview({ warehouses }: WarehouseOverviewProps) {
    if (!warehouses || warehouses.length === 0) {
        return (
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Warehouse className="h-5 w-5" />
                    <h3 className="text-sm font-black uppercase tracking-widest">Gudang</h3>
                </div>
                <p className="text-zinc-400 text-sm">Tidak ada gudang aktif</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Warehouse className="h-5 w-5" />
                    <h3 className="text-sm font-black uppercase tracking-widest">Gudang</h3>
                </div>
                <Link
                    href="/inventory/warehouses"
                    className="text-xs font-bold text-zinc-500 hover:text-black dark:hover:text-white flex items-center gap-1 transition-colors"
                >
                    Lihat Semua <ArrowRight className="h-3 w-3" />
                </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                {warehouses.map((wh) => (
                    <Link
                        key={wh.code}
                        href="/inventory/warehouses"
                        className="group bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 transition-all hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px]"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <div className="font-black text-sm">{wh.name}</div>
                                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{wh.code}</div>
                            </div>
                            <Package className="h-5 w-5 text-zinc-300 group-hover:text-black dark:group-hover:text-white transition-colors" />
                        </div>

                        <div className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white mb-1">
                            {formatCompact(wh.value)}
                        </div>

                        <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-400">
                            <span>{wh.itemCount.toLocaleString("id-ID")} unit</span>
                            <span className="text-zinc-200 dark:text-zinc-700">|</span>
                            <span>{wh.productCount} produk</span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}
