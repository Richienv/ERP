"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Factory, AlertCircle, ArrowRight } from "lucide-react"
import Link from "next/link"

export function ProductionLineStatus() {
    const lines = [
        { id: "Line 1", name: "Weaving", job: "SO-2026-0256", desc: "5000m Cotton", progress: 78, status: "On Schedule", color: "text-emerald-600", supervisor: "Pak Budi", eta: "Jan 10, 3PM" },
        { id: "Line 2", name: "Knitting", job: "SO-2026-0245", desc: "3000 pcs T-shirt", progress: 45, status: "Delayed 4hrs", color: "text-amber-600", supervisor: "Ibu Siti", eta: "Delayed" },
        { id: "Line 3", name: "Dyeing", job: "MAINTENANCE", desc: "Repair in progress", progress: 0, status: "Down since 2PM", color: "text-red-600", supervisor: "Pak Joko", eta: "Jan 10, 9AM" },
        { id: "Line 4", name: "Dyeing", job: "SO-2026-0234", desc: "Navy fabric Rework", progress: 0, status: "Quality Hold", color: "text-red-600", supervisor: "Ibu Dewi", eta: "Decision Needed" },
        { id: "Line 5", name: "Finishing", job: "SO-2026-0267", desc: "2000m Ready", progress: 92, status: "Finishing", color: "text-emerald-600", supervisor: "Pak Bambang", eta: "Ship today 8PM" },
    ]

    return (
        <Link href="/manufacturing" className="block h-full group/card">
            <div className="relative bg-white dark:bg-black border border-black rounded-xl min-h-[400px] flex flex-col overflow-hidden shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] h-full transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">

                <CardHeader className="relative z-10 flex flex-row items-center justify-between p-6 border-b border-black space-y-0 bg-zinc-50 dark:bg-zinc-900 group-hover/card:bg-zinc-100 transition-colors">
                    <div>
                        <CardTitle className="text-lg font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                            Status Stasiun Fisik
                            <ArrowRight className="h-4 w-4 opacity-0 group-hover/card:opacity-100 -translate-x-2 group-hover/card:translate-x-0 transition-all text-black" />
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">Pemantauan Line Produksi Real-time</p>
                    </div>
                    <div className="h-10 w-10 rounded border border-black bg-white flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover/card:shadow-none group-hover/card:translate-x-[1px] group-hover/card:translate-y-[1px] transition-all">
                        <Factory className="h-5 w-5 text-black" />
                    </div>
                </CardHeader>

                <CardContent className="relative z-10 p-6 overflow-y-auto">
                    <div className="space-y-6">
                        {lines.map((line) => (
                            <div key={line.id} className="grid grid-cols-12 gap-4 items-center border-b border-black/10 pb-4 last:border-0 last:pb-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 p-2 -mx-2 rounded transition-colors group">
                                {/* Column 1: Line Details */}
                                <div className="col-span-3">
                                    <div className="font-bold text-foreground text-sm flex items-center gap-2">
                                        <div className="h-2 w-2 bg-black rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
                                        {line.id}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground font-mono mt-1">{line.name} • {line.supervisor}</div>
                                </div>

                                {/* Column 2: Job Info */}
                                <div className="col-span-4 pl-2">
                                    <Badge variant="secondary" className="font-mono font-bold text-[10px] mb-1 bg-white border border-black/20 text-black shadow-sm">{line.job}</Badge>
                                    <div className="text-xs font-bold leading-tight text-foreground">{line.desc}</div>
                                </div>

                                {/* Column 3: Progress & Status */}
                                <div className="col-span-5 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-1.5">
                                            {line.progress === 0 && <AlertCircle className="h-3 w-3 text-red-600 animate-pulse" />}
                                            <span className={`text-xs font-black ${line.status.includes("Down") || line.status.includes("Hold") ? "text-red-600" : line.status.includes("Delayed") ? "text-amber-600" : "text-emerald-700"}`}>
                                                {line.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <span className="text-xs font-mono font-bold text-black dark:text-white">{line.progress}%</span>
                                    </div>
                                    <Progress value={line.progress} className={`h-2 border border-black/10 rounded-full ${line.progress === 0 ? "bg-red-100 dark:bg-red-950/30" : "bg-zinc-100"}`} />
                                    <div className="text-[10px] text-right text-muted-foreground font-medium">{line.eta}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </div>
        </Link>
    )
}
