"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, Phone, AlertCircle } from "lucide-react"

export function ManagerWorkload() {
    const managers = [
        {
            name: "Pak Bambang",
            role: "Production Manager",
            avatar: "PB",
            active: 12,
            completed: 8,
            overdue: 2,
            focus: "Rescheduling orders after Line 3 down",
            lastUpdate: "15 mins ago",
            status: "warning", // because overdue > 0
            color: "bg-blue-100 text-blue-700"
        },
        {
            name: "Ibu Dewi",
            role: "QC Manager",
            avatar: "ID",
            active: 7,
            completed: 12,
            overdue: 1,
            focus: "Color defect approval pending (2 hrs)",
            lastUpdate: "8 mins ago",
            status: "critical",
            color: "bg-pink-100 text-pink-700"
        },
        {
            name: "Pak Andi",
            role: "Purchase Manager",
            avatar: "PA",
            active: 15,
            completed: 6,
            overdue: 0,
            focus: "Negotiating polyester yarn price",
            lastUpdate: "32 mins ago",
            status: "good",
            color: "bg-amber-100 text-amber-700"
        }
    ]

    return (
        <Card className="h-full">
            <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg font-serif">👥 Manager Workload & Accountability</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y">
                    {managers.map((mgr) => (
                        <div key={mgr.name} className="p-6 transition-colors hover:bg-muted/30">
                            <div className="flex items-start justify-between">
                                <div className="flex gap-4">
                                    <Avatar className="h-12 w-12 border">
                                        <AvatarFallback className={mgr.color}>{mgr.avatar}</AvatarFallback>
                                    </Avatar>
                                    <div className="space-y-1">
                                        <div className="font-semibold text-base">{mgr.name}</div>
                                        <div className="text-xs text-muted-foreground uppercase font-medium">{mgr.role}</div>

                                        <div className="flex items-center gap-3 text-sm pt-1">
                                            <span className="flex items-center gap-1">
                                                Active: <b>{mgr.active}</b>
                                            </span>
                                            <span className="flex items-center gap-1 text-muted-foreground">
                                                <CheckCircle2 className="h-3 w-3" /> {mgr.completed}
                                            </span>
                                            {mgr.overdue > 0 ? (
                                                <span className={`flex items-center gap-1 font-bold ${mgr.status === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>
                                                    <AlertCircle className="h-3 w-3" /> {mgr.overdue} Overdue
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-emerald-600">
                                                    <CheckCircle2 className="h-3 w-3" /> ON TRACK
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right space-y-2">
                                    <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                                        <Clock className="h-3 w-3" /> Updated {mgr.lastUpdate}
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <Button variant="outline" size="xs" className="h-7 text-xs">View Tasks</Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7"><Phone className="h-3 w-3" /></Button>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 bg-muted/40 p-3 rounded-lg border border-border/50 text-sm">
                                <span className="text-muted-foreground font-medium text-xs uppercase mr-2">Current Focus:</span>
                                {mgr.focus}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
