"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowUpRight, CheckCircle2, XCircle, Filter, Factory, Clock } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export function DetailedAlerts() {
    const [selectedAlert, setSelectedAlert] = useState<any>(null)
    const [isOpen, setIsOpen] = useState(false)

    const alerts = [
        { id: 1, type: "Major Defect", title: "Order #SO-2026-0234 (Zara)", message: "1,500m dyed wrong color. Impact: Rp 67.5M Loss.", details: "Quality control detected significant color variance. Batch re-dye required.", machine: "Dyeing Unit A-02", severity: "critical", time: "2 hours ago", status: "Open" },
        { id: 2, type: "Machine Breakdown", title: "Dyeing Machine #2", message: "Affecting 3 orders. Cost: Rp 45M.", details: "Main pump failure. Maintenance called.", machine: "Dyeing Unit D-02", severity: "high", time: "4 hours ago", status: "Open" },
        { id: 3, type: "Supply Shortage", title: "Raw Cotton - Warehouse B", message: "Stock below safety level (500kg). Production halt risk.", details: "Requires immediate procurement order.", machine: "Warehouse B", severity: "medium", time: "6 hours ago", status: "Investigating" },
        { id: 4, type: "Quality Warning", title: "Finishing Level C", message: "Uneven texture detected in recent batch check.", details: "Check roller calibration.", machine: "Finishing Line 1", severity: "low", time: "1 day ago", status: "Resolved" },
    ]

    const handleAlertClick = (alert: any) => {
        setSelectedAlert(alert)
        setIsOpen(true)
    }

    return (
        <div className="h-full">
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
                            <div
                                key={alert.id}
                                onClick={() => handleAlertClick(alert)}
                                className="p-4 hover:bg-white transition-colors group cursor-pointer"
                            >
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
                                        <p className="text-sm text-muted-foreground line-clamp-1">{alert.message}</p>
                                    </div>
                                    <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button size="sm" className="h-8 bg-black text-white hover:bg-zinc-800 shadow-sm text-xs">Resolve</Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Detail Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-md border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white p-0 overflow-hidden gap-0">
                    <DialogHeader className="p-6 bg-zinc-50 border-b border-black">
                        <div className="flex items-center gap-2 mb-2">
                            <Badge variant={selectedAlert?.severity === 'critical' ? 'destructive' : 'outline'} className="rounded-sm shadow-none">{selectedAlert?.type}</Badge>
                            <span className="text-xs font-mono text-muted-foreground">ID: #ALT-{selectedAlert?.id}</span>
                        </div>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">{selectedAlert?.title}</DialogTitle>
                        <DialogDescription className="font-medium text-black/70">
                            Occurred {selectedAlert?.time} • Status: {selectedAlert?.status}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="p-4 border border-black/10 rounded-lg bg-zinc-50">
                                <h4 className="text-sm font-black uppercase tracking-wider mb-2">Issue Description</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {selectedAlert?.message} {selectedAlert?.details}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 border border-black/10 rounded-lg bg-zinc-50">
                                    <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Machine Impacted</span>
                                    <div className="flex items-center gap-2">
                                        <Factory className="h-4 w-4" />
                                        <span className="font-bold text-sm">{selectedAlert?.machine}</span>
                                    </div>
                                </div>
                                <div className="p-3 border border-black/10 rounded-lg bg-zinc-50">
                                    <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Severity</span>
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className={`h-4 w-4 ${selectedAlert?.severity === 'critical' ? 'text-red-600' : 'text-amber-500'}`} />
                                        <span className={`font-bold text-sm capitalize ${selectedAlert?.severity === 'critical' ? 'text-red-700' : ''}`}>{selectedAlert?.severity}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-zinc-50 border-t border-black gap-2">
                        <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1 border-black font-bold">Close</Button>
                        <Button className="flex-1 bg-black text-white hover:bg-zinc-800 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none font-bold">
                            Resolve Issue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
