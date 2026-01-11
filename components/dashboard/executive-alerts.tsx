"use client"

import { useState } from "react"
import { AlertCircle, Users, ArrowUpRight, CheckCircle2, Factory, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export function ExecutiveAlerts() {
    const [selectedAlert, setSelectedAlert] = useState<any>(null)
    const [isOpen, setIsOpen] = useState(false)

    const alerts = [
        {
            id: 1,
            type: "Major Defect",
            title: "Order #SO-2026-0234 (Zara)",
            message: "1,500m dyed wrong color. Impact: Rp 67.5M Loss.",
            impact: "Rp 67.5M",
            details: "Quality control detected significant color variance in Batch #992. The entire batch needs re-dyeing or scrapping. This will delay shipment by 3 days.",
            severity: "critical",
            machine: "Dyeing Unit A-02"
        },
        {
            id: 2,
            type: "Machine Breakdown",
            title: "Dyeing Machine #2",
            message: "Affecting 3 orders. Cost: Rp 45M.",
            impact: "Rp 45M",
            details: "Main pump failure detected. Maintenance team alerted. Estimated repair time: 4 hours. Backlog accumulating for Orders #202, #205.",
            severity: "high",
            machine: "Dyeing Unit D-02"
        }
    ]

    const handleAlertClick = (alert: any) => {
        setSelectedAlert(alert)
        setIsOpen(true)
    }

    return (
        <div className="h-full group/alert">
            <div className="relative bg-white dark:bg-black border border-black rounded-xl h-full flex flex-col overflow-hidden shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all">

                {/* Header - Ritchie Minimal Style */}
                <div className="relative z-10 flex flex-row items-center justify-between p-6 border-b border-black space-y-0 bg-zinc-50 dark:bg-zinc-900">
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
                    {alerts.map((alert) => (
                        <div
                            key={alert.id}
                            onClick={() => handleAlertClick(alert)}
                            className="bg-white dark:bg-zinc-900 border border-black p-5 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant={alert.severity === 'critical' ? 'destructive' : 'outline'} className={`rounded-md shadow-sm border border-black/20 ${alert.severity !== 'critical' ? 'text-amber-600 bg-amber-50' : ''}`}>
                                            {alert.type}
                                        </Badge>
                                        <span className="font-bold text-sm text-foreground">{alert.title}</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {alert.message.split('Impact:')[0]}
                                        Cost: <span className={`font-bold px-1 rounded ${alert.severity === 'critical' ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50'}`}>{alert.impact}</span>
                                    </p>
                                </div>
                                <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg border-black bg-white hover:bg-zinc-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none transition-all">
                                    <ArrowUpRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer with properly routed View All button */}
                <div className="p-4 border-t border-black bg-zinc-50 dark:bg-zinc-900 text-center flex justify-between items-center">
                    <p className="text-xs font-bold text-red-600 flex items-center gap-2">
                        <AlertCircle className="h-3 w-3" />
                        {alerts.length} Issues Active
                    </p>
                    <Link href="/manufacturing">
                        <Button size="sm" className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[1px] text-xs font-bold uppercase transition-all">
                            View Control Room
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Detail Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-xl border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white p-0 overflow-hidden gap-0">
                    <DialogHeader className="p-6 bg-zinc-50 border-b border-black flex flex-row items-start justify-between space-y-0">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant="destructive" className="rounded-sm shadow-none uppercase tracking-widest text-[10px]">{selectedAlert?.type}</Badge>
                                <span className="text-xs font-mono text-muted-foreground">ID: #ALT-{selectedAlert?.id}</span>
                            </div>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight leading-none">{selectedAlert?.title}</DialogTitle>
                            <DialogDescription className="font-medium text-black/70 mt-2 text-base">
                                Detected at {new Date().toLocaleTimeString()} • <span className="text-red-600 font-bold">Unresolved</span>
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="p-6 space-y-6">
                        {/* 1. Executive Summary Box */}
                        <div className="bg-red-50 border-2 border-red-100 rounded-xl p-5 flex items-start gap-4">
                            <div className="bg-white p-2 rounded-lg border border-red-100 shadow-sm shrink-0">
                                <AlertCircle className="h-6 w-6 text-red-600" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black uppercase tracking-wider text-red-900 mb-1">Executive Summary</h4>
                                <p className="text-sm text-red-800 leading-relaxed font-medium">
                                    {selectedAlert?.details}
                                    <span className="block mt-2 font-bold">Recommended Action: Immediate intervention required by Operations Manager.</span>
                                </p>
                            </div>
                        </div>

                        {/* 2. Key Metrics Grid */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 border border-black/10 rounded-xl bg-zinc-50 space-y-1">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                    Financial Impact
                                </span>
                                <p className="text-xl font-black text-red-600">{selectedAlert?.impact}</p>
                            </div>
                            <div className="p-4 border border-black/10 rounded-xl bg-zinc-50 space-y-1">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                    Operational Stall
                                </span>
                                <p className="text-xl font-black text-foreground">4 hrs</p>
                            </div>
                            <div className="p-4 border border-black/10 rounded-xl bg-zinc-50 space-y-1">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                    Customer Risk
                                </span>
                                <p className="text-xl font-black text-foreground">High</p>
                            </div>
                        </div>

                        {/* 3. Responsibility Chain */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b border-black/5 pb-2">Accountability Chain</h4>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-zinc-200 border border-black flex items-center justify-center font-bold text-xs">AM</div>
                                    <div>
                                        <p className="text-sm font-bold">Andi Mulyono</p>
                                        <p className="text-[10px] text-muted-foreground">Floor Manager</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <Badge variant="outline" className="text-[10px] border-black text-red-600 bg-red-50">Notified 10m ago</Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-zinc-50 border-t border-black gap-2">
                        <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1 border-black font-bold h-12 text-sm uppercase tracking-wide">
                            Dismiss
                        </Button>
                        <Link href="/manufacturing" className="flex-1">
                            <Button className="w-full bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] font-black h-12 text-sm uppercase tracking-wide transition-all">
                                Open War Room
                            </Button>
                        </Link>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
