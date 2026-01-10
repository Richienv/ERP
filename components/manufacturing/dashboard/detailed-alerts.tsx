"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowUpRight, CheckCircle2, XCircle, Filter } from "lucide-react"

export function DetailedAlerts() {
    const alerts = [
        { id: 1, type: "Major Defect", title: "Order #SO-2026-0234 (Zara)", message: "1,500m dyed wrong color. Impact: Rp 67.5M Loss.", severity: "critical", time: "2 hours ago", status: "Open" },
        { id: 2, type: "Machine Breakdown", title: "Dyeing Machine #2", message: "Affecting 3 orders. Cost: Rp 45M.", severity: "high", time: "4 hours ago", status: "Open" },
        { id: 3, type: "Supply Shortage", title: "Raw Cotton - Warehouse B", message: "Stock below safety level (500kg). Production halt risk.", severity: "medium", time: "6 hours ago", status: "Investigating" },
        { id: 4, type: "Quality Warning", title: "Finishing Level C", message: "Uneven texture detected in recent batch check.", severity: "low", time: "1 day ago", status: "Resolved" },
    ]

    return (
        <Card className="h-full flex flex-col border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white dark:bg-black">
            <CardHeader className="p-6 border-b border-black bg-zinc-50 dark:bg-zinc-900 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        Operational Alert Log
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Real-time issues requiring intervention.</p>
                </div>
                <Button variant="outline" size="sm" className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-white h-8 gap-2">
                    <Filter className="h-4 w-4" /> Filter
                </Button>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto bg-zinc-50/30">
                <div className="divide-y divide-black/10">
                    {alerts.map((alert) => (
                        <div key={alert.id} className="p-4 hover:bg-white transition-colors group">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        {alert.severity === 'critical' || alert.severity === 'high' ? (
                                            <Badge variant="destructive" className="rounded-md shadow-sm border border-black/20">{alert.type}</Badge>
                                        ) : (
                                            <Badge variant="outline" className="border-black text-black bg-white">{alert.type}</Badge>
                                        )}
                                        <span className="text-xs text-muted-foreground font-mono">{alert.time}</span>
                                    </div>
                                    <h4 className="font-bold text-base">{alert.title}</h4>
                                    <p className="text-sm text-muted-foreground">{alert.message}</p>
                                </div>
                                <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="sm" className="h-8 bg-black text-white hover:bg-zinc-800 shadow-sm text-xs">Resolve</Button>
                                    <Button size="sm" variant="ghost" className="h-8 text-xs">Dismiss</Button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {/* Empty State / More */}
                    <div className="p-4 text-center">
                        <Button variant="ghost" className="text-xs text-muted-foreground">View Archived Alerts</Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
