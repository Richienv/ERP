"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, Factory, TrendingUp, Users, AlertTriangle, Clock, ShieldAlert, ArrowRight, XCircle } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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

            {/* Critical Alerts Component with Dialogs */}
            <CriticalAlertsSection />
        </div>
    )
}

function CriticalAlertsSection() {
    const [action, setAction] = useState<{ type: 'reject_order' | 'approve_rework' | 'outsource' | 'approve_repair', id: string } | null>(null)

    return (
        <div className="border border-black bg-white dark:bg-black rounded-xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-3 mb-6 border-b border-black/10 pb-4">
                <div className="h-8 w-8 bg-red-600 rounded flex items-center justify-center text-white border border-black shadow-sm">
                    <AlertCircle className="h-5 w-5 animate-pulse" />
                </div>
                <h3 className="font-black text-xl tracking-tight">CRITICAL ALERTS <span className="text-muted-foreground font-normal text-sm ml-2">(Action Required)</span></h3>
            </div>

            <div className="space-y-4">
                {/* Alert 1: Defect */}
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
                        <Button onClick={() => setAction({ type: 'reject_order', id: 'SO-2026-0234' })} variant="outline" size="sm" className="bg-white border-black text-black hover:bg-black hover:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all">Reject Order</Button>
                        <Button onClick={() => setAction({ type: 'approve_rework', id: 'SO-2026-0234' })} size="sm" className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] hover:translate-y-[1px] hover:shadow-none transition-all">Approve Rework</Button>
                    </div>
                </div>

                {/* Alert 2: Breakdown */}
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
                        <Button onClick={() => setAction({ type: 'outsource', id: 'MAC-002' })} variant="outline" size="sm" className="bg-white border-black text-black hover:bg-black hover:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all">Outsource</Button>
                        <Button onClick={() => setAction({ type: 'approve_repair', id: 'MAC-002' })} size="sm" className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] hover:translate-y-[1px] hover:shadow-none transition-all">Approve Repair</Button>
                    </div>
                </div>
            </div>

            {/* UNIFIED ACTION DIALOG */}
            <ActionDialog
                action={action}
                open={!!action}
                onOpenChange={(open) => !open && setAction(null)}
            />
        </div>
    )
}

function ActionDialog({ action, open, onOpenChange }: any) {
    if (!action) return null

    const getContent = () => {
        switch (action.type) {
            case 'reject_order':
                return {
                    title: "Reject Order #SO-2026-0234",
                    description: "This action will cancel the production batch and notify the client.",
                    content: (
                        <div className="space-y-4 pt-4">
                            <div className="bg-red-50 p-4 rounded border-l-4 border-red-500 text-red-900 text-sm">
                                <span className="font-bold block mb-1">Impact Warning:</span>
                                Rejecting this order will result in a <strong>Rp 67.5M write-off</strong> and potential penalty fees from Zara.
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase">Reason for Rejection (Required)</Label>
                                <Textarea placeholder="Explain why rework is not possible..." className="border-black min-h-[100px]" />
                            </div>
                        </div>
                    ),
                    button: <Button className="bg-red-600 text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:bg-red-700 font-bold w-full">CONFIRM REJECTION</Button>,
                    headerClass: "bg-red-50 dark:bg-red-900/20"
                }
            case 'approve_rework':
                return {
                    title: "Approve Rework Plan",
                    description: "Authorize re-dying process for 1,500 meters.",
                    content: (
                        <div className="space-y-4 pt-4">
                            <div className="flex items-center gap-4 bg-zinc-50 p-4 border border-black/10 rounded-lg">
                                <div className="h-10 w-10 flex-shrink-0 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <ShieldAlert className="h-6 w-6 text-emerald-600" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-bold text-sm">Double Confirmation Required</h4>
                                    <p className="text-xs text-muted-foreground">Are you sure? This will consume <strong>Rp 12M</strong> in additional chemicals and delay delivery by 2 days.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div className="p-2 border rounded bg-zinc-50">
                                    <span className="text-muted-foreground block">New Delivery Date</span>
                                    <span className="font-bold">18 Jan 2026 (Delayed)</span>
                                </div>
                                <div className="p-2 border rounded bg-zinc-50">
                                    <span className="text-muted-foreground block">Cost Increase</span>
                                    <span className="font-bold text-red-600">+15%</span>
                                </div>
                            </div>
                        </div>
                    ),
                    button: <Button className="bg-black text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:bg-zinc-800 font-bold w-full">AUTHORIZE REWORK</Button>,
                    headerClass: "bg-emerald-50 dark:bg-emerald-900/20"
                }
            case 'outsource':
                return {
                    title: "Outsource Production",
                    description: "Transfer 4,500m order to partner factory.",
                    content: (
                        <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase">Select Partner Factory</Label>
                                <Select>
                                    <SelectTrigger className="border-black"><SelectValue placeholder="Choose Factory" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="sr">PT. Sumber Rejeki (Cibubur)</SelectItem>
                                        <SelectItem value="gi">PT. Garment Indah (Bandung)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase">Agreed Cost per Meter</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-sm font-bold">Rp</span>
                                    <Input placeholder="0" className="pl-9 border-black" />
                                </div>
                            </div>
                        </div>
                    ),
                    button: <Button className="bg-black text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:bg-zinc-800 font-bold w-full">INITIATE OUTSOURCE CONTRACT</Button>,
                    headerClass: "bg-amber-50 dark:bg-amber-900/20"
                }
            case 'approve_repair':
                return {
                    title: "Approve Emergency Repair",
                    description: "Authorize purchase of spare parts from Singapore.",
                    content: (
                        <div className="space-y-4 pt-4">
                            <div className="flex items-center gap-4 bg-orange-50 p-4 border border-orange-100 rounded-lg">
                                <div className="h-10 w-10 flex-shrink-0 bg-orange-100 rounded-full flex items-center justify-center">
                                    <AlertTriangle className="h-6 w-6 text-orange-600" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-bold text-sm text-orange-800">Budget Overflow Warning</h4>
                                    <p className="text-xs text-orange-700">Cost <strong>Rp 45M</strong> exceeds monthly maintenance budget. Approved by Director automatically.</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase">Add Note for Finance (Optional)</Label>
                                <Textarea placeholder="Reason for urgency..." className="border-black h-20" />
                            </div>
                        </div>
                    ),
                    button: <Button className="bg-black text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:bg-zinc-800 font-bold w-full">APPROVE PURCHASE (Rp 45M)</Button>,
                    headerClass: "bg-blue-50 dark:bg-blue-900/20"
                }
        }
    }

    const { title, description, content, button, headerClass } = getContent()!

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 gap-0 bg-white">
                <DialogHeader className={`p-6 border-b border-black ${headerClass}`}>
                    <DialogTitle className="text-xl font-black uppercase leading-tight">{title}</DialogTitle>
                    <DialogDescription className="text-black/60 font-medium">{description}</DialogDescription>
                </DialogHeader>

                <div className="p-6">
                    {content}
                </div>

                <DialogFooter className="p-4 border-t border-black bg-zinc-50 flex gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 border-black font-bold uppercase bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all">Cancel</Button>
                    <div className="flex-1">{button}</div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
