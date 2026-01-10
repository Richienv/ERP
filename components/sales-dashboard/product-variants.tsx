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
        <Card className="col-span-1 md:col-span-3 lg:col-span-3 h-full">
            <CardHeader>
                <CardTitle>Top Produk (Kain)</CardTitle>
                <CardDescription>Penjualan berdasarkan jenis bahan</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[250px] w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={productData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {productData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="text-center text-sm">
                    <span className="font-bold text-blue-600">Cotton Combed 30s</span> adalah produk terlaris bulan ini.
                </div>
            </CardContent>
        </Card>
    )
}
