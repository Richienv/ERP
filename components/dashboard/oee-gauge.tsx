"use client"

import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts"
import { Gauge } from "lucide-react"

interface OEEGaugeProps {
    oee: number
    availability: number
    performance: number
    quality: number
}

function getOEEStatus(oee: number): { label: string; color: string; bg: string } {
    if (oee >= 85) return { label: "World Class", color: "text-emerald-600", bg: "bg-emerald-500" }
    if (oee >= 65) return { label: "Baik", color: "text-blue-600", bg: "bg-blue-500" }
    if (oee >= 40) return { label: "Perlu Perbaikan", color: "text-amber-600", bg: "bg-amber-500" }
    return { label: "Kritis", color: "text-red-600", bg: "bg-red-500" }
}

export function OEEGauge({ oee, availability, performance, quality }: OEEGaugeProps) {
    const status = getOEEStatus(oee)

    const chartData = [
        { name: "Quality", value: quality, fill: "#10b981" },
        { name: "Performance", value: performance, fill: "#3b82f6" },
        { name: "Availability", value: availability, fill: "#f59e0b" },
        { name: "OEE", value: oee, fill: "#18181b" },
    ]

    const metrics = [
        { label: "Availability", value: availability, color: "bg-amber-500" },
        { label: "Performance", value: performance, color: "bg-blue-500" },
        { label: "Quality", value: quality, color: "bg-emerald-500" },
    ]

    return (
        <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800">
                <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-zinc-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">OEE Hari Ini</span>
                </div>
                <div className={`h-2 w-2 rounded-full ${status.bg}`} />
            </div>

            {/* Chart + Big Number */}
            <div className="flex-1 flex items-center justify-center relative py-2">
                <div className="w-[140px] h-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart
                            cx="50%"
                            cy="50%"
                            innerRadius="30%"
                            outerRadius="100%"
                            data={chartData}
                            startAngle={180}
                            endAngle={0}
                            barSize={8}
                        >
                            <RadialBar
                                background={{ fill: "#f4f4f5" }}
                                dataKey="value"
                                cornerRadius={0}
                            />
                        </RadialBarChart>
                    </ResponsiveContainer>
                </div>

                {/* Center overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingTop: '8px' }}>
                    <span className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                        {oee.toFixed(0)}%
                    </span>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${status.color}`}>
                        {status.label}
                    </span>
                </div>
            </div>

            {/* Breakdown */}
            <div className="border-t-2 border-dashed border-zinc-200 px-4 py-2.5">
                <div className="grid grid-cols-3 gap-2">
                    {metrics.map((m) => (
                        <div key={m.label} className="text-center">
                            <div className="flex items-center justify-center gap-1 mb-0.5">
                                <div className={`h-1.5 w-1.5 rounded-full ${m.color}`} />
                                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">
                                    {m.label.slice(0, 4)}
                                </span>
                            </div>
                            <span className="text-sm font-black text-zinc-900 dark:text-white">
                                {m.value.toFixed(0)}%
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
