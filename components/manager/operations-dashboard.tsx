"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, Factory, TrendingUp, Users, AlertTriangle, Clock } from "lucide-react"

export function OperationsDashboard() {
    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white dark:bg-black border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-muted-foreground flex items-center justify-between uppercase tracking-wider">
                            Production Efficiency
                            <TrendingUp className="h-4 w-4 text-black dark:text-white" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black">87%</div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">Target: 85% <span className="text-emerald-600 font-bold">(+2%)</span></p>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-black border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-muted-foreground flex items-center justify-between uppercase tracking-wider">
                            Orders On-Track
                            <Clock className="h-4 w-4 text-black dark:text-white" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black">23 / 28</div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">5 Orders at Risk <span className="text-amber-600 font-bold">(Needs Attention)</span></p>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-black border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-muted-foreground flex items-center justify-between uppercase tracking-wider">
                            Quality Pass Rate
                            <CheckCircle2 className="h-4 w-4 text-black dark:text-white" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black">94%</div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">Target: 95% <span className="text-red-600 font-bold">(-1%)</span></p>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-black border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-muted-foreground flex items-center justify-between uppercase tracking-wider">
                            Active Workers
                            <Users className="h-4 w-4 text-black dark:text-white" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black">142 / 150</div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">8 Absent Today <span className="text-muted-foreground font-bold">(Shift 1)</span></p>
                    </CardContent>
                </Card>
            </div>

            {/* Critical Alerts Section */}
            <div className="border border-black bg-white dark:bg-black rounded-xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center gap-3 mb-6 border-b border-black/10 pb-4">
                    <div className="h-8 w-8 bg-red-600 rounded flex items-center justify-center text-white border border-black shadow-sm">
                        <AlertCircle className="h-5 w-5 animate-pulse" />
                    </div>
                    <h3 className="font-black text-xl tracking-tight">CRITICAL ALERTS <span className="text-muted-foreground font-normal text-sm ml-2">(Action Required)</span></h3>
                </div>

                <div className="space-y-4">
                    {/* Alert 1 */}
                    <div className="bg-red-50 dark:bg-red-900/10 border border-black p-4 rounded-lg flex flex-col md:flex-row gap-4 items-start md:items-center justify-between hover:translate-x-1 transition-transform cursor-pointer">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Badge className="bg-red-600 text-white border-black shadow-sm rounded-md">Major Defect</Badge>
                                <span className="font-bold text-foreground">Order #SO-2026-0234 (Zara)</span>
                            </div>
                            <p className="text-sm text-foreground/80 font-medium pt-1">1,500 meters dyed wrong color. Impact: Rp 67.5M potential loss.</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <Users className="h-3 w-3" />
                                Assigned to: <span className="font-bold text-foreground">Ibu Dewi (QC Manager)</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="bg-white border-black text-black hover:bg-black hover:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Reject Order</Button>
                            <Button size="sm" className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]">Approve Rework</Button>
                        </div>
                    </div>

                    {/* Alert 2 */}
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-black p-4 rounded-lg flex flex-col md:flex-row gap-4 items-start md:items-center justify-between hover:translate-x-1 transition-transform cursor-pointer">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Badge className="bg-amber-500 text-black border-black shadow-sm rounded-md hover:bg-amber-600">Machine Breakdown</Badge>
                                <span className="font-bold text-foreground">Dyeing Machine #2</span>
                            </div>
                            <p className="text-sm text-foreground/80 font-medium pt-1">Affecting 3 orders (4,500m). Spare parts needed from Singapore (Rp 45M).</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <Users className="h-3 w-3" />
                                Assigned to: <span className="font-bold text-foreground">Pak Joko (Maintenance)</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="bg-white border-black text-black hover:bg-black hover:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Outsource</Button>
                            <Button size="sm" className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]">Approve Repair</Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
