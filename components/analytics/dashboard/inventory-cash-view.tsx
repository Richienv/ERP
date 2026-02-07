"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"

const inventorySplit = [
    { name: 'Raw Material', value: 45, color: '#3b82f6' },
    { name: 'WIP', value: 30, color: '#f59e0b' },
    { name: 'Finished', value: 25, color: '#10b981' },
]

const agingData = [
    { name: '0-30 Hari', value: 120 },
    { name: '31-60 Hari', value: 80 },
    { name: '61-90 Hari', value: 45 },
    { name: '>90 Hari', value: 35 }, // Bad
]

export function InventoryCashView() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Inventory Value Split */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Komposisi Nilai Persediaan</CardTitle>
                    <CardDescription>Breakdown Total Aset Inventori</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={inventorySplit}
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {inventorySplit.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                    {/* Legend Overlay */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                        <span className="text-2xl font-bold">Rp 4.2M</span>
                        <p className="text-xs text-muted-foreground">Total Value</p>
                    </div>
                </CardContent>
            </Card>

            {/* Inventory Aging */}
            <Card className="shadow-sm border-r-4 border-r-orange-400">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                        <CardTitle>Umur Stok (Aging)</CardTitle>
                        <CardDescription>Barang Slow Moving ({'>'}90 Hari)</CardDescription>
                    </div>
                    <div className="text-right">
                        <span className="text-2xl font-bold text-orange-600">Rp 350jt</span>
                        <p className="text-xs text-muted-foreground">Stuck in {'>'}90 Days</p>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-[150px] w-full mb-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={agingData}>
                                <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="value" fill="#fb923c" radius={[4, 4, 0, 0]} barSize={40}>
                                    {agingData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.name === '>90 Hari' ? '#ef4444' : '#fb923c'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <Button variant="outline" className="w-full border-orange-200 text-orange-700 hover:bg-orange-50">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Buat Kampanye Clearance Sale
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
