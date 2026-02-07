"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const steps = [
    { label: "Quotation", count: 45, value: "Rp 4.5M", color: "bg-zinc-400", textColor: "text-zinc-600" },
    { label: "SO Confirmed", count: 18, value: "Rp 2.8M", color: "bg-blue-500", textColor: "text-blue-600" },
    { label: "In Production", count: 12, value: "Rp 1.9M", color: "bg-orange-500", textColor: "text-orange-600" },
    { label: "Delivered", count: 8, value: "Rp 1.2M", color: "bg-emerald-500", textColor: "text-emerald-600" },
    { label: "Invoiced", count: 5, value: "Rp 850jt", color: "bg-purple-500", textColor: "text-purple-600" },
]

export function SalesPipelineWidget() {
    return (
        <Card className="col-span-1 md:col-span-3 lg:col-span-5 h-full border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden">
            <CardHeader className="border-b border-black bg-zinc-50 dark:bg-zinc-900 pb-3">
                <CardTitle className="font-black uppercase tracking-wider text-xl">Order-to-Cash Pipeline</CardTitle>
                <CardDescription className="font-medium text-black/60">Visualisasi flow dari penawaran hingga tagihan</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                <div className="relative pt-6 pb-2">
                    <div className="grid grid-cols-5 gap-0 relative z-10">
                        {steps.map((step, index) => (
                            <div key={step.label} className="relative flex flex-col items-center group">
                                {/* Connector Line */}
                                {index !== steps.length - 1 && (
                                    <div className="absolute top-8 left-[50%] w-full h-[2px] bg-black -z-10" />
                                )}

                                {/* Circle Node - Ritchie Minimal */}
                                <div className={`
                                w-16 h-16 rounded-full flex flex-col items-center justify-center 
                                bg-white border-2 border-black
                                shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-4
                                group-hover:translate-x-[2px] group-hover:translate-y-[2px] group-hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                                transition-all cursor-pointer
                            `}>
                                    <span className="text-xl font-black">{step.count}</span>
                                </div>

                                {/* Label & Value */}
                                <div className="text-center">
                                    <p className="text-xs font-black uppercase tracking-wider">{step.label}</p>
                                    <Badge variant="outline" className="mt-1 border-black text-[10px] font-bold bg-zinc-50">
                                        {step.value}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-black pt-6">
                    <div className="bg-white border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] p-4 rounded-lg">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mb-2 flex items-center gap-2">
                            <div className="h-2 w-2 bg-orange-500 rounded-full border border-black"></div>
                            Backlog Produksi
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-black">12 Orders</span>
                            <span className="text-orange-600 font-bold text-xs uppercase border border-orange-200 bg-orange-50 px-2 py-1 rounded">Perlu Jadwal</span>
                        </div>
                    </div>
                    <div className="bg-white border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] p-4 rounded-lg">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mb-2 flex items-center gap-2">
                            <div className="h-2 w-2 bg-emerald-500 rounded-full border border-black"></div>
                            Siap Kirim
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-black">8 Orders</span>
                            <span className="text-emerald-600 font-bold text-xs uppercase border border-emerald-200 bg-emerald-50 px-2 py-1 rounded">Menunggu DO</span>
                        </div>
                    </div>
                    <div className="bg-white border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] p-4 rounded-lg">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mb-2 flex items-center gap-2">
                            <div className="h-2 w-2 bg-red-600 rounded-full border border-black"></div>
                            Risk Revenue
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-black">Rp 350jt</span>
                            <span className="text-red-600 font-bold text-xs uppercase border border-red-200 bg-red-50 px-2 py-1 rounded">No Invoice</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
