"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, ArrowRight, Microscope, Target, FileWarning } from "lucide-react"
import Link from "next/link"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function QualityTrackingCard() {
    const [selectedItem, setSelectedItem] = useState<any>(null)
    const [isOpen, setIsOpen] = useState(false)

    const inspections = [
        {
            id: 1,
            batch: "Batch #4092",
            material: "Cotton 30s",
            time: "2m ago",
            result: "Pass",
            color: "text-emerald-500",
            badgeColor: "bg-emerald-100 text-emerald-800",
            defectType: "None",
            inspector: "Sarah (QC Lead)"
        },
        {
            id: 2,
            batch: "Batch #4091",
            material: "Dyeing Navy",
            time: "15m ago",
            result: "Fail",
            color: "text-red-500",
            badgeColor: "bg-red-100 text-red-800",
            defectType: "Color Mismatch (Delta E > 2.0)",
            inspector: "Budi (QC)"
        },
        {
            id: 3,
            batch: "Batch #4090",
            material: "Cotton 24s",
            time: "45m ago",
            result: "Pass",
            color: "text-emerald-500",
            badgeColor: "bg-emerald-100 text-emerald-800",
            defectType: "None",
            inspector: "Sarah (QC Lead)"
        },
    ]

    const handleItemClick = (item: any) => {
        setSelectedItem(item)
        setIsOpen(true)
    }

    return (
        <div className="h-full group/card">
            <Card className="h-full flex flex-col border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white dark:bg-black hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-200">
                <CardHeader className="pb-3 border-b border-black bg-zinc-50 dark:bg-zinc-900 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        Quality Control
                    </CardTitle>
                    <Badge variant="outline" className="bg-white text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        98.5% Pass
                    </Badge>
                </CardHeader>
                <CardContent className="p-4 flex-1 space-y-4">
                    {/* Main Stats */}
                    <div className="flex items-center justify-between p-3 bg-zinc-50 border border-black rounded-lg shadow-sm">
                        <span className="text-sm font-bold text-muted-foreground">Today's Rate</span>
                        <span className="text-3xl font-black text-emerald-600">98.5%</span>
                    </div>

                    {/* Recent Inspections List */}
                    <div className="space-y-3">
                        <p className="text-xs font-black uppercase text-muted-foreground tracking-wider">Latest Inspections</p>

                        <div className="space-y-1">
                            {inspections.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => handleItemClick(item)}
                                    className="flex items-center justify-between p-2 border-b border-black/5 hover:bg-zinc-50 transition-colors cursor-pointer rounded-lg group/item"
                                >
                                    <div className="flex items-center gap-3">
                                        {item.result === 'Pass' ?
                                            <CheckCircle2 className={`h-4 w-4 ${item.color}`} /> :
                                            <XCircle className={`h-4 w-4 ${item.color}`} />
                                        }
                                        <div>
                                            <p className="font-bold text-xs group-hover/item:text-emerald-600 transition-colors">{item.batch}</p>
                                            <p className="text-[10px] text-muted-foreground">{item.material} • {item.time}</p>
                                        </div>
                                    </div>
                                    <Badge variant="secondary" className={`text-[10px] ${item.badgeColor}`}>{item.result}</Badge>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-2 flex items-center justify-center">
                        <Link href="/manufacturing/quality">
                            <div className="flex items-center text-xs font-bold text-muted-foreground hover:text-emerald-600 transition-colors cursor-pointer">
                                View Full Report <ArrowRight className="ml-1 h-3 w-3" />
                            </div>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {/* Detail Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-xl border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white p-0 overflow-hidden gap-0">
                    <DialogHeader className="p-6 bg-zinc-50 border-b border-black">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge variant={selectedItem?.result === 'Pass' ? "default" : "destructive"} className="rounded-sm shadow-none uppercase tracking-wider h-6">{selectedItem?.result}</Badge>
                                    <span className="text-xs font-mono text-muted-foreground">ID: QC-{selectedItem?.id}992</span>
                                </div>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight leading-none">{selectedItem?.batch}</DialogTitle>
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-bold text-muted-foreground uppercase block mb-1">Impact Score</span>
                                <div className={`text-xl font-black ${selectedItem?.result === 'Pass' ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {selectedItem?.result === 'Pass' ? '100/100' : '32/100'}
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="p-6 space-y-6">
                        {/* 1. Defect Analysis (Conditional) */}
                        {selectedItem?.result === 'Fail' ? (
                            <div className="bg-red-50 border-2 border-red-100 rounded-xl p-5 flex items-start gap-4">
                                <div className="bg-white p-2 rounded-lg border border-red-100 shadow-sm shrink-0">
                                    <FileWarning className="h-6 w-6 text-red-600 animate-pulse" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black uppercase tracking-wider text-red-900 mb-1">Critical Defect Detected</h4>
                                    <p className="text-sm text-red-800 leading-relaxed font-bold">
                                        {selectedItem?.defectType}
                                    </p>
                                    <p className="text-xs text-red-700 mt-2">Recommended Action: Isolate batch and initiate Root Cause Analysis (RCA).</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-emerald-50 border-2 border-emerald-100 rounded-xl p-5 flex items-center gap-4">
                                <div className="bg-white p-2 rounded-lg border border-emerald-100 shadow-sm">
                                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black uppercase tracking-wider text-emerald-900">Quality Certified</h4>
                                    <p className="text-sm text-emerald-800">Batch meets all ISO-9001 standards for color fastness and durability.</p>
                                </div>
                            </div>
                        )}

                        {/* 2. Inspection Metrics */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 border border-black/10 rounded-xl bg-zinc-50 space-y-1">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                    <Microscope className="h-3 w-3" /> Material
                                </span>
                                <p className="text-lg font-black">{selectedItem?.material}</p>
                            </div>
                            <div className="p-4 border border-black/10 rounded-xl bg-zinc-50 space-y-1">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                    <Target className="h-3 w-3" /> Certified By
                                </span>
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6 border border-black"><AvatarFallback className="text-[10px] font-bold bg-black text-white">QC</AvatarFallback></Avatar>
                                    <p className="text-sm font-bold">{selectedItem?.inspector}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-zinc-50 border-t border-black gap-3">
                        <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1 border-black font-bold h-12 uppercase tracking-wide">Close</Button>
                        <Link href={`/manufacturing/quality`} className="flex-1">
                            <Button className="w-full bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none font-black h-12 uppercase tracking-wide transition-all">
                                Open QC Report
                            </Button>
                        </Link>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
