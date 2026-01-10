"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

const steps = [
    { label: "Quotation", count: 45, value: "Rp 4.5M", color: "bg-zinc-400", textColor: "text-zinc-600" },
    { label: "SO Confirmed", count: 18, value: "Rp 2.8M", color: "bg-blue-500", textColor: "text-blue-600" },
    { label: "In Production", count: 12, value: "Rp 1.9M", color: "bg-orange-500", textColor: "text-orange-600" },
    { label: "Delivered", count: 8, value: "Rp 1.2M", color: "bg-emerald-500", textColor: "text-emerald-600" },
    { label: "Invoiced", count: 5, value: "Rp 850jt", color: "bg-purple-500", textColor: "text-purple-600" },
]

export function SalesPipelineWidget() {
    return (
        <Card className="col-span-1 md:col-span-3 lg:col-span-5 h-full">
            <CardHeader>
                <CardTitle>Order-to-Cash Pipeline</CardTitle>
                <CardDescription>Visualisasi flow dari penawaran hingga tagihan</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="relative pt-6 pb-2">
                    <div className="grid grid-cols-5 gap-0 relative z-10">
                        {steps.map((step, index) => (
                            <div key={step.label} className="relative flex flex-col items-center group">
                                {/* Connector Line */}
                                {index !== steps.length - 1 && (
                                    <div className="absolute top-8 left-[50%] w-full h-[2px] bg-zinc-200 dark:bg-zinc-800 -z-10" />
                                )}

                                {/* Circle Node */}
                                <div className={`
                                w-16 h-16 rounded-full flex flex-col items-center justify-center 
                                ${step.color} text-white shadow-lg mb-3 ring-4 ring-white dark:ring-zinc-950 transition-transform group-hover:scale-110
                            `}>
                                    <span className="text-lg font-bold">{step.count}</span>
                                </div>

                                {/* Label & Value */}
                                <div className="text-center">
                                    <p className="text-sm font-semibold">{step.label}</p>
                                    <p className={`text-xs font-bold ${step.textColor} mt-1`}>{step.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t pt-6">
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg">
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-2">Backlog Produksi</p>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold">12 Orders</span>
                            <span className="text-orange-600 font-medium">Perlu Jadwal</span>
                        </div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg">
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-2">Siap Kirim</p>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold">8 Orders</span>
                            <span className="text-emerald-600 font-medium">Menunggu DO</span>
                        </div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg">
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-2">Risk Revenue</p>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold">Rp 350jt</span>
                            <span className="text-red-600 font-medium">Delivered, No Invoice</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
