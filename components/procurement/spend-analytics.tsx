"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts"

const SPEND_BY_CATEGORY = [
    { name: "Bahan Baku", value: 450000000, color: "#3b82f6" }, // Blue
    { name: "Packaging", value: 120000000, color: "#10b981" }, // Emerald
    { name: "Sparepart", value: 85000000, color: "#f59e0b" }, // Amber
    { name: "Logistik", value: 45000000, color: "#8b5cf6" }, // Violet
    { name: "Jasa", value: 30000000, color: "#ec4899" }, // Pink
    { name: "Lainnya", value: 15000000, color: "#64748b" }, // Slate
]

const formatCompactCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        notation: "compact",
        maximumFractionDigits: 1
    }).format(value);
}

export function SpendAnalyticsWidget() {
    return (
        <div className="relative">
            <Badge className="absolute -top-2 -right-2 z-10 bg-amber-100 text-amber-800 border border-amber-300 text-[8px] font-black uppercase tracking-widest rounded-none px-1.5 py-0.5">
                Data Demo
            </Badge>
        <Card className="col-span-1 md:col-span-3 lg:col-span-3 h-full">
            <CardHeader>
                <CardTitle>Spend by Category</CardTitle>
                <CardDescription>Analisis pengeluaran per kategori bulan ini</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={SPEND_BY_CATEGORY} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} interval={0} />
                            <Tooltip
                                formatter={(value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value)}
                                cursor={{ fill: 'transparent' }}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                {SPEND_BY_CATEGORY.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Spend:</span>
                    <span className="font-bold text-lg">Rp 745 Jt</span>
                </div>
            </CardContent>
        </Card>
        </div>
    )
}
