"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Activity, AlertTriangle, CheckCircle, Clock, Truck } from "lucide-react"

export function ProcurementPipeline() {
    const rfqSteps = [
        { label: "Draft", count: 2, color: "bg-zinc-200" },
        { label: "Terkirim", count: 5, color: "bg-blue-200" },
        { label: "Menunggu", count: 3, color: "bg-yellow-200" },
        { label: "Dipilih", count: 1, color: "bg-green-200" }
    ]

    const poSteps = [
        { label: "Draft PO", count: 1, color: "bg-zinc-200" },
        { label: "Approval", count: 2, color: "bg-orange-200" },
        { label: "Terkonfirmasi", count: 8, color: "bg-blue-200" },
        { label: "Pengiriman", count: 4, color: "bg-purple-200" },
        { label: "Diterima", count: 12, color: "bg-green-200" }
    ]

    return (
        <Card className="col-span-1 md:col-span-3 lg:col-span-3 h-full">
            <CardHeader>
                <CardTitle>Pipeline Pengadaan</CardTitle>
                <CardDescription>Visualisasi status RFQ dan Pesanan Pembelian aktif</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* RFQ Pipeline */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium">
                        <span className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            RFQ Flow
                        </span>
                        <span className="text-muted-foreground">11 Aktif</span>
                    </div>
                    <div className="flex h-4 w-full overflow-hidden rounded-full bg-secondary">
                        {rfqSteps.map((step) => (
                            <div key={step.label} className={`h-full ${step.color} hover:opacity-80 transition-opacity`} style={{ width: `${(step.count / 11) * 100}%` }} title={`${step.label}: ${step.count}`} />
                        ))}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                        {rfqSteps.map((step) => (
                            <div key={step.label} className="flex flex-col items-center">
                                <span className="font-semibold text-foreground">{step.count}</span>
                                <span>{step.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* PO Pipeline */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium">
                        <span className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            PO Flow
                        </span>
                        <span className="text-muted-foreground">27 Aktif</span>
                    </div>
                    <div className="relative flex w-full items-center justify-between">
                        {/* A simple visual step tracker instead of a bar for POs to show linear progression */}
                        {poSteps.map((step, index) => (
                            <div key={step.label} className="flex flex-col items-center gap-2 z-10 relative group">
                                <div className={`
                                h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                                ${index < 3 ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-muted-foreground text-muted-foreground'}
                            `}>
                                    {step.count}
                                </div>
                                <span className="text-[10px] font-medium text-center max-w-[60px] leading-tight">{step.label}</span>
                            </div>
                        ))}
                        {/* Connector Line */}
                        <div className="absolute top-4 left-0 w-full h-0.5 bg-muted -z-0" />
                        <div className="absolute top-4 left-0 w-[60%] h-0.5 bg-primary -z-0" />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
