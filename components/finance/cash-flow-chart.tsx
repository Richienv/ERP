"use client"

import { ResponsiveContainer, Tooltip, XAxis, Area, AreaChart, CartesianGrid, YAxis } from "recharts"
import { cn } from "@/lib/utils"

interface CashFlowPoint {
    date: string
    day: string
    incoming: number
    outgoing: number
}

export function CashFlowChart({ className, data }: { className?: string; data: CashFlowPoint[] }) {
    return (
        <div className={cn("bg-card border border-border/50 rounded-2xl p-6 shadow-sm", className)}>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="font-serif text-lg font-medium">Cash Flow Forecast</h3>
                    <p className="text-sm text-muted-foreground">Pemasukan vs Pengeluaran (7 Hari)</p>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2 text-xs font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Masuk
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span> Keluar
                    </div>
                </div>
            </div>

            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                        <XAxis
                            dataKey="day"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        />
                        <Tooltip
                            contentStyle={{
                                borderRadius: '12px',
                                border: '1px solid hsl(var(--border))',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                backgroundColor: 'hsl(var(--card))'
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="incoming"
                            stroke="#10b981"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorIn)"
                        />
                        <Area
                            type="monotone"
                            dataKey="outgoing"
                            stroke="#f43f5e"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorOut)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
