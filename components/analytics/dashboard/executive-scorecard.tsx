"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ArrowDown, ArrowUp, Activity, DollarSign, Clock, AlertTriangle, Package } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AreaChart, Area, ResponsiveContainer } from "recharts"

const kpiData = [
    {
        title: "Margin Kotor",
        value: "24%",
        subValue: "Rp 480jt",
        trend: "-4%",
        trendUp: false,
        icon: Activity,
        color: "text-blue-600",
        bgColor: "bg-blue-100",
        chartColor: "#2563eb",
        data: [28, 30, 29, 26, 25, 24]
    },
    {
        title: "On-Time Delivery",
        value: "92%",
        subValue: "Target 95%",
        trend: "+2%",
        trendUp: true,
        icon: Clock,
        color: "text-green-600",
        bgColor: "bg-green-100",
        chartColor: "#16a34a",
        data: [88, 89, 90, 89, 91, 92]
    },
    {
        title: "Defect Cost",
        value: "Rp 95jt",
        subValue: "High Scrap",
        trend: "+15%",
        trendUp: false, // bad
        icon: AlertTriangle,
        color: "text-red-600",
        bgColor: "bg-red-100",
        chartColor: "#dc2626",
        data: [70, 75, 72, 80, 85, 95]
    },
    {
        title: "Cash Cycle",
        value: "45 Hari",
        subValue: "Standard 40",
        trend: "+5 Hari",
        trendUp: false,
        icon: DollarSign,
        color: "text-purple-600",
        bgColor: "bg-purple-100",
        chartColor: "#9333ea",
        data: [38, 40, 42, 41, 43, 45]
    },
    {
        title: "Inventory Days",
        value: "68 Hari",
        subValue: "Slow Moving",
        trend: "+8 Hari",
        trendUp: false,
        icon: Package,
        color: "text-orange-600",
        bgColor: "bg-orange-100",
        chartColor: "#ea580c",
        data: [60, 62, 61, 64, 66, 68]
    },
]

export function ExecutiveScorecard() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {kpiData.map((kpi, index) => {
                const isBad = (kpi.title === "Margin Kotor" && kpi.trend.startsWith("-")) ||
                    (kpi.title === "Defect Cost" && kpi.trend.startsWith("+")) ||
                    (kpi.title === "Cash Cycle" && kpi.trend.startsWith("+")) ||
                    (kpi.title === "Inventory Days" && kpi.trend.startsWith("+"));

                const ArrowIcon = kpi.trend.startsWith("+") ? ArrowUp : ArrowDown;
                const trendColor = isBad ? "text-red-500" : "text-green-500";

                // Transform data array to object array for Recharts
                const chartData = kpi.data.map(val => ({ value: val }));

                return (
                    <Card key={index} className="shadow-sm hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden">
                        <CardContent className="p-4 flex flex-col justify-between h-full relative z-10">
                            <div className="flex justify-between items-start mb-2">
                                <div className={`p-2 rounded-lg ${kpi.bgColor} bg-opacity-50 backdrop-blur-sm`}>
                                    <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                                </div>
                                <Badge variant="outline" className={`${trendColor} border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-black/80 font-bold flex items-center gap-1 shadow-sm`}>
                                    <ArrowIcon className="h-3 w-3" /> {kpi.trend}
                                </Badge>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold tracking-tight">{kpi.value}</h3>
                                <p className="text-sm font-medium text-muted-foreground mr-6">{kpi.title}</p>
                                <p className="text-xs text-muted-foreground mt-1 opacity-80">{kpi.subValue}</p>
                            </div>
                        </CardContent>

                        {/* Sparkline Chart Background */}
                        <div className="absolute bottom-0 left-0 right-0 h-16 opacity-20 pointer-events-none">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke={kpi.chartColor}
                                        fill={kpi.chartColor}
                                        strokeWidth={2}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                )
            })}
        </div>
    )
}
