"use client"

import { Scissors, TrendingUp } from "lucide-react"

interface UtilizationChartProps {
    markerEfficiency: number | null
    totalLayers: number | null
    totalFabricMeters: number | null
    totalPlanned: number
    totalActual: number
    totalDefect: number
}

export function UtilizationChart({
    markerEfficiency,
    totalLayers,
    totalFabricMeters,
    totalPlanned,
    totalActual,
    totalDefect,
}: UtilizationChartProps) {
    const yieldPct = totalActual + totalDefect > 0
        ? Math.round((totalActual / (totalActual + totalDefect)) * 100)
        : 0

    const fulfillmentPct = totalPlanned > 0
        ? Math.round((totalActual / totalPlanned) * 100)
        : 0

    return (
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="px-4 py-2.5 border-b-2 border-black bg-zinc-50 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-zinc-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Utilisasi & Efisiensi
                </span>
            </div>

            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Marker Efficiency */}
                <MetricGauge
                    label="Efisiensi Marker"
                    value={markerEfficiency ?? 0}
                    suffix="%"
                    color={
                        (markerEfficiency ?? 0) >= 85
                            ? 'bg-emerald-500'
                            : (markerEfficiency ?? 0) >= 70
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                    }
                />

                {/* Yield */}
                <MetricGauge
                    label="Yield"
                    value={yieldPct}
                    suffix="%"
                    color={
                        yieldPct >= 95
                            ? 'bg-emerald-500'
                            : yieldPct >= 85
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                    }
                />

                {/* Fulfillment */}
                <MetricGauge
                    label="Pemenuhan"
                    value={fulfillmentPct}
                    suffix="%"
                    color={
                        fulfillmentPct >= 95
                            ? 'bg-emerald-500'
                            : fulfillmentPct >= 80
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                    }
                />

                {/* Summary */}
                <div className="flex flex-col justify-center gap-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase">Layer</span>
                        <span className="text-xs font-black">{totalLayers ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase">Kain (m)</span>
                        <span className="text-xs font-mono font-bold">
                            {totalFabricMeters?.toFixed(1) ?? '0'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase">Cacat</span>
                        <span className="text-xs font-mono font-bold text-red-600">
                            {totalDefect.toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function MetricGauge({
    label,
    value,
    suffix,
    color,
}: {
    label: string
    value: number
    suffix: string
    color: string
}) {
    const clampedValue = Math.min(Math.max(value, 0), 100)

    return (
        <div className="text-center">
            <div className="text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                {label}
            </div>
            <div className="relative w-16 h-16 mx-auto mb-1">
                {/* Background circle */}
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        stroke="#e4e4e7"
                        strokeWidth="3"
                    />
                    <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        className={color.replace('bg-', 'stroke-')}
                        strokeWidth="3"
                        strokeDasharray={`${clampedValue} ${100 - clampedValue}`}
                        strokeLinecap="round"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black">{value}</span>
                </div>
            </div>
            <span className="text-[9px] font-bold text-zinc-400">{suffix}</span>
        </div>
    )
}
