"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Ruler } from "lucide-react"

interface MeasurementPoint {
    measurePoint: string
    specValue: number
    actualValue: number
    tolerance: number
    withinSpec: boolean
}

interface GarmentMeasurementChartProps {
    measurements: MeasurementPoint[]
    title?: string
}

export function GarmentMeasurementChart({ measurements, title }: GarmentMeasurementChartProps) {
    const chartData = measurements.map((m) => ({
        name: m.measurePoint,
        spec: m.specValue,
        actual: m.actualValue,
        toleranceHigh: m.specValue + m.tolerance,
        toleranceLow: m.specValue - m.tolerance,
        deviation: Math.abs(m.actualValue - m.specValue),
        withinSpec: m.withinSpec,
    }))

    const passCount = measurements.filter((m) => m.withinSpec).length
    const totalCount = measurements.length
    const passRate = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0

    return (
        <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800">
                <div className="flex items-center gap-2">
                    <Ruler className="h-4 w-4 text-zinc-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        {title ?? 'Measurement Chart'}
                    </span>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 border-2 border-black ${
                    passRate >= 95 ? 'bg-emerald-100 text-emerald-700' :
                    passRate >= 80 ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                }`}>
                    {passCount}/{totalCount} OK
                </span>
            </div>

            {/* Chart */}
            <div className="p-4">
                {measurements.length === 0 ? (
                    <div className="h-[200px] flex items-center justify-center border-2 border-dashed border-zinc-200">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ada data pengukuran</span>
                    </div>
                ) : (
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} barGap={2} barSize={16}>
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 9, fontWeight: 800 }}
                                    tickLine={false}
                                    axisLine={{ stroke: '#18181b', strokeWidth: 2 }}
                                />
                                <YAxis
                                    tick={{ fontSize: 9, fontWeight: 700 }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={36}
                                />
                                <Tooltip
                                    contentStyle={{
                                        border: '2px solid black',
                                        borderRadius: 0,
                                        boxShadow: '3px 3px 0px 0px rgba(0,0,0,1)',
                                        fontSize: 11,
                                        fontWeight: 700,
                                    }}
                                    formatter={(value: number, name: string) => [
                                        `${value.toFixed(1)} cm`,
                                        name === 'spec' ? 'Spec' : 'Aktual',
                                    ]}
                                />
                                <Bar dataKey="spec" fill="#d4d4d8" name="Spec" />
                                <Bar dataKey="actual" name="Aktual">
                                    {chartData.map((item, i) => (
                                        <Cell
                                            key={i}
                                            fill={item.withinSpec ? '#18181b' : '#ef4444'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Detail table */}
            {measurements.length > 0 && (
                <div className="border-t-2 border-black">
                    <table className="w-full text-xs">
                        <thead className="bg-zinc-100 border-b-2 border-black">
                            <tr>
                                <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-1.5 text-left">Titik Ukur</th>
                                <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-1.5 text-center">Spec</th>
                                <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-1.5 text-center">Aktual</th>
                                <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-1.5 text-center">Tol.</th>
                                <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-1.5 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {measurements.map((m, i) => (
                                <tr key={i} className="border-b border-zinc-100 last:border-b-0">
                                    <td className="px-3 py-1.5 font-bold">{m.measurePoint}</td>
                                    <td className="px-3 py-1.5 text-center font-mono">{m.specValue.toFixed(1)}</td>
                                    <td className="px-3 py-1.5 text-center font-mono font-bold">{m.actualValue.toFixed(1)}</td>
                                    <td className="px-3 py-1.5 text-center font-mono text-zinc-400">±{m.tolerance.toFixed(1)}</td>
                                    <td className="px-3 py-1.5 text-center">
                                        <span className={`inline-block px-1.5 py-0.5 text-[9px] font-black border ${
                                            m.withinSpec ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-red-100 text-red-700 border-red-300'
                                        }`}>
                                            {m.withinSpec ? 'OK' : 'NG'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
