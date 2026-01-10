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
        <Card className="col-span-1 md:col-span-3 lg:col-span-4 h-full">
            <CardHeader>
                <CardTitle>Order Book vs Kapasitas Pabrik</CardTitle>
                <CardDescription>Monitoring beban produksi mingguan (Yard)</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <XAxis dataKey="week" scale="point" padding={{ left: 10, right: 10 }} />
                            <YAxis />
                            <Tooltip />
                            <Legend verticalAlign="top" height={36} />
                            <Bar dataKey="orders" name="Order Masuk (Yards)" barSize={40} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Line type="monotone" dataKey="capacity" name="Kapasitas Max" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground justify-center">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-blue-500 rounded-sm" /> Order Masuk
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-red-500 rounded-sm" /> Kapasitas (Warning)
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
