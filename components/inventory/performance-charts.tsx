"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Line, LineChart, CartesianGrid } from "recharts";

const dataShipping = [
    { name: "Gudang A", shipped: 450, target: 400 },
    { name: "Gudang B", shipped: 320, target: 350 },
    { name: "Gudang C", shipped: 210, target: 200 },
];

const dataTrend = [
    { time: "08:00", productivity: 85 },
    { time: "10:00", productivity: 92 },
    { time: "12:00", productivity: 60 },
    { time: "14:00", productivity: 88 },
    { time: "16:00", productivity: 95 },
    { time: "18:00", productivity: 70 },
];

export function PerformanceCharts() {
    return (
        <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-card border-border/50 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base font-semibold">Volume Pengiriman Hari Ini</CardTitle>
                    <CardDescription>Perbandingan per gudang vs target</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dataShipping}>
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'var(--muted)/20' }}
                                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                                <Bar dataKey="shipped" name="Terkirim" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="target" name="Target" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-card border-border/50 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base font-semibold">Tren Produktivitas Tenaga Kerja</CardTitle>
                    <CardDescription>Rata-rata lines picking / jam</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dataTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                                <XAxis dataKey="time" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="productivity"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: "var(--background)", strokeWidth: 2 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
