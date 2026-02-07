"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowRight, TrendingUp } from "lucide-react"

const profitData = [
    { name: 'Kaos Polos', profit: 450, revenue: 1200 },
    { name: 'Hoodie', profit: 280, revenue: 600 },
    { name: 'Polo Shirt', profit: 320, revenue: 850 },
    { name: 'Jersey', profit: 150, revenue: 400 },
    { name: 'Kemeja', profit: 200, revenue: 500 },
]

const productTableData = [
    { product: "Kaos Polos Cotton 30s Navy", revenue: "Rp 1.2M", cost: "Rp 950jt", margin: "12%", volume: "25,000", return: "1.2%" },
    { product: "Polyester Blend Grey", revenue: "Rp 450jt", cost: "Rp 280jt", margin: "38%", volume: "8,000", return: "0.5%" },
    { product: "Premium Hoodie Black", revenue: "Rp 600jt", cost: "Rp 320jt", margin: "46%", volume: "3,500", return: "2.1%" },
    { product: "Kids T-Shirt Red", revenue: "Rp 150jt", cost: "Rp 145jt", margin: "3%", volume: "5,000", return: "0.8%" },
]

export function ProfitLossView() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Chart Section */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Keuntungan per Keluarga Produk</CardTitle>
                    <CardDescription>Profit (Margin) vs Pendapatan</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={profitData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `Rp ${value}jt`} />
                                <Tooltip formatter={(value) => `Rp ${value}jt`} />
                                <Legend />
                                <Bar dataKey="revenue" name="Pendapatan" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="profit" name="Profit Margin" fill="#2563eb" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Table Section */}
            <Card className="shadow-sm flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Detail Performansi Produk</CardTitle>
                        <CardDescription>Analisis Margin & Volume</CardDescription>
                    </div>
                    <Button variant="outline" size="sm">
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Simulasi Harga
                    </Button>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Produk</TableHead>
                                <TableHead className="text-right">Margin</TableHead>
                                <TableHead className="text-right">Volume</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {productTableData.map((item, i) => (
                                <TableRow key={i} className="hover:bg-muted/50 cursor-pointer group">
                                    <TableCell>
                                        <div className="font-medium text-sm">{item.product}</div>
                                        <div className="text-xs text-muted-foreground">Rev: {item.revenue} • Cost: {item.cost}</div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className={`font-bold ${parseInt(item.margin) < 15 ? 'text-red-600' : 'text-green-600'}`}>
                                            {item.margin}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right text-sm">{item.volume}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
