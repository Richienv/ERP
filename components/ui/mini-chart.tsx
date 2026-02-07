"use client"

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const data = [
    { time: "08:00", visitors: 120 },
    { time: "09:00", visitors: 180 },
    { time: "10:00", visitors: 350 },
    { time: "11:00", visitors: 450 },
    { time: "12:00", visitors: 320 },
    { time: "13:00", visitors: 550 },
    { time: "14:00", visitors: 620 },
    { time: "15:00", visitors: 480 },
    { time: "16:00", visitors: 380 },
]

interface MiniChartProps {
    className?: string;
}

export function MiniChart({ className }: MiniChartProps) {
    return (
        <div className={cn(
            "group relative w-full p-6 rounded-3xl bg-card border border-border/50 overflow-hidden",
            "hover:shadow-lg transition-all duration-300",
            className
        )}>
            {/* Background Effects */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />

            <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="space-y-1">
                    <h3 className="text-lg font-medium text-foreground tracking-tight">Trafik Pengunjung</h3>
                    <p className="text-sm text-muted-foreground">
                        +12.5% dari minggu lalu
                    </p>
                </div>

                <div className="mt-8 h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <defs>
                                <linearGradient id="line-gradient" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#10b981" />
                                    <stop offset="100%" stopColor="#3b82f6" />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="time"
                                stroke="var(--muted-foreground)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="rounded-lg border border-border bg-popover p-2 shadow-sm">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                            Pengunjung
                                                        </span>
                                                        <span className="font-bold text-muted-foreground">
                                                            {payload[0].value}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    }
                                    return null
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="visitors"
                                stroke="url(#line-gradient)"
                                strokeWidth={3}
                                activeDot={{
                                    r: 6,
                                    style: { fill: "var(--background)", strokeWidth: 2 }
                                }}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    )
}
