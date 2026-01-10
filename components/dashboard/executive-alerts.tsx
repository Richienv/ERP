"use client"

import { AlertCircle, Users, ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function ExecutiveAlerts() {
    return (
        <Link href="/manufacturing" className="block h-full group/alert">
            <div className="relative bg-white dark:bg-black border border-black rounded-xl h-full flex flex-col overflow-hidden shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">

                {/* Header - Ritchie Minimal Style */}
                <div className="relative z-10 flex flex-row items-center justify-between p-6 border-b border-black space-y-0 bg-zinc-50 dark:bg-zinc-900 group-hover/alert:bg-zinc-100 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded border border-black bg-white flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            <AlertCircle className="h-5 w-5 text-red-600 animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-foreground uppercase tracking-wider">Critical Operational Alerts</h3>
                            <p className="text-xs text-muted-foreground mt-1 font-medium">Action Required Immediately</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 flex-1 overflow-y-auto p-6 bg-white dark:bg-black">
                    {/* Alert 1 */}
                    <div className="bg-white dark:bg-zinc-900 border border-black p-5 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer">
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="destructive" className="rounded-md shadow-sm border border-black/20">Major Defect</Badge>
                                    <span className="font-bold text-sm text-foreground">Order #SO-2026-0234 (Zara)</span>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    1,500m dyed wrong color. Impact: <span className="font-bold text-red-600 bg-red-50 dark:bg-red-900/20 px-1 rounded">Rp 67.5M Loss</span>.
                                </p>
                            </div>
                            <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg border-black bg-white hover:bg-zinc-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all">
                                <ArrowUpRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Alert 2 */}
                    <div className="bg-white dark:bg-zinc-900 border border-black p-5 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer">
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="border-black text-amber-600 bg-amber-50 dark:bg-amber-950/20 font-bold rounded-md">Machine Breakdown</Badge>
                                    <span className="font-bold text-sm text-foreground">Dyeing Machine #2</span>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Affecting 3 orders. Cost: <span className="font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1 rounded">Rp 45M</span>.
                                </p>
                            </div>
                            <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg border-black bg-white hover:bg-zinc-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all">
                                <ArrowUpRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-black bg-zinc-50 dark:bg-zinc-900 text-center group-hover/alert:bg-zinc-100 transition-colors">
                    <p className="text-xs font-bold text-red-600 flex items-center justify-center gap-2">
                        <AlertCircle className="h-3 w-3" />
                        Please review with Operations Manager immediately.
                    </p>
                </div>
            </div>
        </Link>
    )
}
