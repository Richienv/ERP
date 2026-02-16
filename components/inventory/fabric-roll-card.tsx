"use client"

import { Package, MapPin, Ruler } from "lucide-react"
import type { FabricRollSummary } from "@/lib/actions/fabric-rolls"

interface FabricRollCardProps {
    roll: FabricRollSummary
    onClick?: () => void
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
    AVAILABLE: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    RESERVED: { bg: 'bg-blue-100', text: 'text-blue-700' },
    IN_USE: { bg: 'bg-amber-100', text: 'text-amber-700' },
    DEPLETED: { bg: 'bg-zinc-100', text: 'text-zinc-500' },
}

const STATUS_LABELS: Record<string, string> = {
    AVAILABLE: 'Tersedia',
    RESERVED: 'Dipesan',
    IN_USE: 'Dipakai',
    DEPLETED: 'Habis',
}

export function FabricRollCard({ roll, onClick }: FabricRollCardProps) {
    const style = STATUS_STYLES[roll.status] ?? STATUS_STYLES.AVAILABLE
    const usedPct = roll.lengthMeters > 0
        ? Math.round(((roll.lengthMeters - roll.remainingMeters) / roll.lengthMeters) * 100)
        : 0

    return (
        <div
            className="border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
            onClick={onClick}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b-2 border-black bg-zinc-50">
                <div className="flex items-center gap-2 min-w-0">
                    <Package className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                    <span className="text-[10px] font-black font-mono truncate">{roll.rollNumber}</span>
                </div>
                <span className={`text-[9px] font-black px-1.5 py-0.5 border border-black ${style.bg} ${style.text}`}>
                    {STATUS_LABELS[roll.status] ?? roll.status}
                </span>
            </div>

            {/* Body */}
            <div className="p-3 space-y-2">
                <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block">Kain</span>
                    <span className="text-xs font-bold truncate block">{roll.productName}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">{roll.productCode}</span>
                </div>

                {/* Meter bar */}
                <div>
                    <div className="flex items-center justify-between text-[9px] font-bold mb-1">
                        <span className="flex items-center gap-1 text-zinc-500">
                            <Ruler className="h-3 w-3" /> Sisa
                        </span>
                        <span className="font-black">
                            {roll.remainingMeters}m / {roll.lengthMeters}m
                        </span>
                    </div>
                    <div className="h-2 bg-zinc-100 border border-black overflow-hidden">
                        <div
                            className={`h-full ${roll.remainingMeters <= 0 ? 'bg-zinc-400' : usedPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${100 - usedPct}%` }}
                        />
                    </div>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 text-[9px] text-zinc-400 font-bold">
                    {roll.dyeLot && <span>Lot: {roll.dyeLot}</span>}
                    {roll.grade && <span>Grade: {roll.grade}</span>}
                    <span className="flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5" /> {roll.warehouseName}
                    </span>
                </div>
            </div>
        </div>
    )
}
