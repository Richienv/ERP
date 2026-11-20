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


interface ExecutiveAlertsProps {
    data: any[]
}

export function ExecutiveAlerts({ data }: ExecutiveAlertsProps) {
    const [selectedAlert, setSelectedAlert] = useState<any>(null)
    const [isOpen, setIsOpen] = useState(false)

    const alerts = data && data.length > 0 ? data : []


    const handleAlertClick = (alert: any) => {
        setSelectedAlert(alert)
        setIsOpen(true)
    }

    return (
        <div className="h-full group/alert">
            <div className="relative bg-white dark:bg-slate-900 border border-border rounded-xl h-full flex flex-col overflow-hidden shadow-sm hover:shadow-sm transition-all">

                {/* Header - Ritchie Minimal Style */}
                <div className="relative z-10 flex flex-row items-center justify-between p-6 border-b border-border space-y-0 bg-zinc-50 dark:bg-zinc-900">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded border border-border bg-white flex items-center justify-center shadow-sm">
                            <AlertCircle className="h-5 w-5 text-red-600 animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-foreground  ">Critical Operational Alerts</h3>
                            <p className="text-xs text-muted-foreground mt-1 font-medium">Action Required Immediately</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-900">
                    {alerts.map((alert) => (
                        <div
                            key={alert.id}
                            onClick={() => handleAlertClick(alert)}
                            className="bg-white dark:bg-zinc-900 border border-border p-5 rounded-xl shadow-sm group hover:shadow-sm transition-all cursor-pointer"
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
                                <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg border-border bg-white hover:bg-zinc-50 shadow-sm active:shadow-none transition-all">
                                    <ArrowUpRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer with properly routed View All button */}
                <div className="p-4 border-t border-border bg-zinc-50 dark:bg-zinc-900 text-center flex justify-between items-center">
                    <p className="text-xs font-bold text-red-600 flex items-center gap-2">
                        <AlertCircle className="h-3 w-3" />
                        {alerts.length} Issues Active
                    </p>
                    <Link href="/manufacturing">
                        <Button size="sm" className="bg-slate-900 text-white hover:bg-zinc-800 border border-border shadow-sm active:shadow-none text-xs font-bold transition-all">
                            View Control Room
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Detail Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-xl border border-border shadow-sm bg-white p-0 overflow-hidden gap-0">
                    <DialogHeader className="p-6 bg-zinc-50 border-b border-border flex flex-row items-start justify-between space-y-0">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant="destructive" className="rounded-sm shadow-none text-xs">{selectedAlert?.type}</Badge>
                                <span className="text-xs font-mono text-muted-foreground">ID: #ALT-{selectedAlert?.id}</span>
                            </div>
                            <DialogTitle className="text-2xl font-semibold tracking-tight leading-none">{selectedAlert?.title}</DialogTitle>
                            <DialogDescription className="font-medium text-black/70 mt-2 text-base">
                                Detected at {new Date().toLocaleTimeString()} • <span className="text-red-600 font-bold">Unresolved</span>
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="p-6 space-y-6">
                        {/* 1. Executive Summary Box */}
                        <div className="bg-red-50 border border-red-100 rounded-xl p-5 flex items-start gap-4">
                            <div className="bg-white p-2 rounded-lg border border-red-100 shadow-sm shrink-0">
                                <AlertCircle className="h-6 w-6 text-red-600" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-red-900 mb-1">Executive Summary</h4>
                                <p className="text-sm text-red-800 leading-relaxed font-medium">
                                    {selectedAlert?.details}
                                    <span className="block mt-2 font-bold">Recommended Action: Immediate intervention required by Operations Manager.</span>
                                </p>
                            </div>
                        </div>

                        {/* 2. Key Metrics Grid */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 border border-black/10 rounded-xl bg-zinc-50 space-y-1">
                                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                                    Financial Impact
                                </span>
                                <p className="text-xl font-semibold text-red-600">{selectedAlert?.impact}</p>
                            </div>
                            <div className="p-4 border border-black/10 rounded-xl bg-zinc-50 space-y-1">
                                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                                    Operational Stall
                                </span>
                                <p className="text-xl font-semibold text-foreground">4 hrs</p>
                            </div>
                            <div className="p-4 border border-black/10 rounded-xl bg-zinc-50 space-y-1">
                                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                                    Customer Risk
                                </span>
                                <p className="text-xl font-semibold text-foreground">High</p>
                            </div>
                        </div>

                        {/* 3. Responsibility Chain */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-muted-foreground border-b border-black/5 pb-2">Accountability Chain</h4>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-zinc-200 border border-border flex items-center justify-center font-bold text-xs">AM</div>
                                    <div>
                                        <p className="text-sm font-bold">Andi Mulyono</p>
                                        <p className="text-xs text-muted-foreground">Floor Manager</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <Badge variant="outline" className="text-xs border-border text-red-600 bg-red-50">Notified 10m ago</Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-zinc-50 border-t border-border gap-2">
                        <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1 border-border font-bold h-12 text-sm  ">
                            Dismiss
                        </Button>
                        <Link href="/manufacturing" className="flex-1">
                            <Button className="w-full bg-slate-900 text-white hover:bg-zinc-800 border border-border shadow-sm active:shadow-none font-semibold h-12 text-sm transition-all">
                                Open War Room
                            </Button>
                        </Link>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
