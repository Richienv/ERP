"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"

const productData = [
    { name: "Cotton Combed 30s", value: 45, margin: 12 },
    { name: "Cotton Combed 24s", value: 25, margin: 15 },
    { name: "Rayon Viscose", value: 15, margin: 18 },
    { name: "Polyester PE", value: 10, margin: 8 },
    { name: "Others", value: 5, margin: 10 },
]

const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

export function ProductVariantWidget() {
    return (
        <Card className="col-span-1 md:col-span-3 lg:col-span-3 h-full border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden">
            <CardHeader className="border-b border-black bg-zinc-50 dark:bg-zinc-900 pb-3">
                <CardTitle className="font-black uppercase tracking-wider text-xl">Top Produk</CardTitle>
                <CardDescription className="font-medium text-black/60">Penjualan berdasarkan jenis bahan</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                <div className="h-[250px] w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={productData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={90}
                                paddingAngle={2}
                                dataKey="value"
                                stroke="black"
                                strokeWidth={2}
                            >
                                {productData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: '2px solid black', boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)' }}
                                itemStyle={{ fontWeight: 'bold' }}
                            />
                            <Legend iconType="circle" />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="text-center text-sm border-t border-black pt-4 mt-2">
                    <span className="font-black text-blue-600 uppercase">Cotton Combed 30s</span> adalah produk terlaris bulan ini.
                </div>
            </CardContent>
        </Card>
    )
}
