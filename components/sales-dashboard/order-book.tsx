"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Line, ComposedChart } from "recharts"

const data = [
    { week: "W1", capacity: 50000, orders: 42000 },
    { week: "W2", capacity: 50000, orders: 48000 },
    { week: "W3", capacity: 50000, orders: 55000 }, // Overload
    { week: "W4", capacity: 50000, orders: 38000 },
]

export function OrderBookWidget() {
    return (
        <Card className="col-span-1 md:col-span-3 lg:col-span-4 h-full border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden">
            <CardHeader className="border-b border-black bg-zinc-50 dark:bg-zinc-900 pb-3">
                <CardTitle className="font-black uppercase tracking-wider text-xl">Order Book vs Kapasitas</CardTitle>
                <CardDescription className="font-medium text-black/60">Monitoring beban produksi mingguan (Yard)</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                <div className="h-[250px] w-full border border-black bg-white rounded-lg p-2 shadow-sm">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <XAxis dataKey="week" scale="point" padding={{ left: 10, right: 10 }} tick={{ fill: 'black', fontSize: 12, fontWeight: 'bold' }} axisLine={{ stroke: 'black' }} tickLine={{ stroke: 'black' }} />
                            <YAxis tick={{ fill: 'black', fontSize: 10 }} axisLine={{ stroke: 'black' }} tickLine={{ stroke: 'black' }} />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: '2px solid black', boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)' }}
                                itemStyle={{ fontWeight: 'bold' }}
                            />
                            <Legend verticalAlign="top" height={36} iconType="rect" />
                            <Bar
                                dataKey="orders"
                                name="Order Masuk (Yards)"
                                barSize={40}
                                fill="#2563eb"
                                radius={[0, 0, 0, 0]}
                                stroke="black"
                                strokeWidth={2}
                            />
                            <Line
                                type="step"
                                dataKey="capacity"
                                name="Kapasitas Max"
                                stroke="#ef4444"
                                strokeWidth={3}
                                strokeDasharray="5 5"
                                dot={{ stroke: 'black', strokeWidth: 2, fill: '#ef4444', r: 4 }}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold uppercase mt-4 justify-center">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-600 border border-black" /> Order Masuk
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 border border-black" /> Kapasitas (Warning)
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
