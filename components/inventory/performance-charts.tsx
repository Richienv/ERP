"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Line, LineChart, CartesianGrid, Area, AreaChart } from "recharts";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle } from "lucide-react";

// Mock Data: Predictive Stock Burn
const dataBurnDown = [
    { day: "Sen", stock: 5000, projected: 5000 },
    { day: "Sel", stock: 4500, projected: 4200 }, // Selling slower
    { day: "Rab", stock: 4100, projected: 3400 },
    { day: "Kam", stock: 2800, projected: 2600 }, // Big dip
    { day: "Jum", stock: 1500, projected: 1800 },
    { day: "Sab", stock: 800, projected: 1000 },
    { day: "Min", stock: 100, projected: 200 }, // Critical
];

// Mock Data: Cost per Order Fulfillment
const dataCost = [
    { hour: "08:00", cost: 15000 },
    { hour: "10:00", cost: 12500 }, // Efficient
    { hour: "12:00", cost: 25000 }, // Inefficient (Lunch coverage?)
    { hour: "14:00", cost: 13000 },
    { hour: "16:00", cost: 11000 }, // Very Efficient
];

export function PerformanceCharts() {
    return (
        <div className="grid gap-6 md:grid-cols-2">

            {/* CHART 1: Predictive Stock Burn */}
            <Card className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl flex flex-col">
                <CardHeader className="border-b-2 border-black bg-zinc-50 pb-4 flex flex-row items-start justify-between">
                    <div>
                        <CardTitle className="text-lg font-black uppercase text-black">Prediksi Habis Stok</CardTitle>
                        <CardDescription className="font-bold text-xs uppercase text-zinc-500 mt-1">
                            Aktual vs Model ML (7 Hari ke depan)
                        </CardDescription>
                    </div>
                    <Badge variant="destructive" className="border-2 border-black font-black animate-pulse">
                        <AlertTriangle className="mr-1 h-3 w-3" /> RISK: MINGGU
                    </Badge>
                </CardHeader>
                <CardContent className="pt-6 flex-1">
                    <div className="h-[250px] w-full bg-white border-2 border-black rounded-lg p-2 shadow-inner bg-zinc-50/50">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dataBurnDown}>
                                <defs>
                                    <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#000000" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#000000" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                                <XAxis dataKey="day" fontSize={10} tickLine={false} axisLine={false} fontWeight={700} dy={10} />
                                <YAxis fontSize={10} tickLine={false} axisLine={false} fontWeight={700} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '0px', border: '2px solid black', boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)', fontWeight: 'bold' }}
                                />
                                <Area type="monotone" dataKey="projected" stroke="#9ca3af" strokeDasharray="5 5" strokeWidth={2} fill="transparent" name="Model Prediction" />
                                <Area type="monotone" dataKey="stock" stroke="#000000" strokeWidth={3} fillOpacity={1} fill="url(#colorStock)" name="Actual Level" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 p-3 bg-yellow-50 border-2 border-black rounded-lg text-xs font-bold text-yellow-900 flex items-start">
                        <AlertTriangle className="h-4 w-4 mr-2 shrink-0" />
                        Insight: Penurunan stok hari Kamis lebih tajam dari prediksi. Disarankan restock Jumat pagi.
                    </div>
                </CardContent>
            </Card>

            {/* CHART 2: Efficiency (Cost per Order) */}
            <Card className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl flex flex-col">
                <CardHeader className="border-b-2 border-black bg-zinc-50 pb-4">
                    <CardTitle className="text-lg font-black uppercase text-black">Biaya Operasional / Order</CardTitle>
                    <CardDescription className="font-bold text-xs uppercase text-zinc-500">Analisis Efisiensi Handling per Shift</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 flex-1">
                    <div className="h-[250px] w-full bg-white border-2 border-black rounded-lg p-2 shadow-inner bg-zinc-50/50">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dataCost}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                                <XAxis dataKey="hour" fontSize={10} tickLine={false} axisLine={false} fontWeight={700} dy={10} />
                                <YAxis fontSize={10} tickLine={false} axisLine={false} fontWeight={700} tickFormatter={(value) => `${value / 1000}k`} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                    contentStyle={{ borderRadius: '0px', border: '2px solid black', boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)', fontWeight: 'bold' }}
                                />
                                <Bar dataKey="cost" fill="#16a34a" radius={[4, 4, 0, 0]} name="Cost per Order (IDR)" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 p-3 bg-green-50 border-2 border-black rounded-lg text-xs font-bold text-green-900 flex items-start">
                        <TrendingUp className="h-4 w-4 mr-2 shrink-0" />
                        Efficiency Alert: Shift 14:00 - 16:00 memiliki Cost per Handling terendah (Rp 11k/order). Jadikan benchmark SOP.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
