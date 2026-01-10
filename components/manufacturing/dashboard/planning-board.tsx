"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowRight, AlertTriangle, User } from "lucide-react"

// Mock Data for Gantt
const activePOs = [
    { id: "PO-8932", product: "Cotton Combed 30s Navy", status: "Late", stage: "Pewarnaan", progress: 60, delay: "Mesin #04 Slow" },
    { id: "PO-8933", product: "Polyester Blend Grey", status: "On Track", stage: "Penenunan", progress: 40, delay: null },
    { id: "PO-8934", product: "Rayon Viscose Black", status: "On Track", stage: "Persiapan", progress: 15, delay: null },
    { id: "PO-8935", product: "Spandex Fiber White", status: "Risk", stage: "QC", progress: 90, delay: "Waiting Lab" },
]

const stages = ["Persiapan", "Penenunan", "Pewarnaan", "QC", "Penyelesaian"]

// Mock Data for Machine Grid
const machineSchedule = [
    { machine: "Mesin #01 (Loom)", shifts: [{ job: "PO-8933", status: "Running", progress: 45 }, { job: "PO-8934", status: "Scheduled", progress: 0 }] },
    { machine: "Mesin #02 (Loom)", shifts: [{ job: "Idle", status: "Idle", progress: 0 }, { job: "Maintenance", status: "Maintenance", progress: 0 }] },
    { machine: "Mesin #03 (Dye)", shifts: [{ job: "PO-8932", status: "Running", progress: 60 }, { job: "PO-8935", status: "Scheduled", progress: 0 }] },
    { machine: "Mesin #04 (Dye)", shifts: [{ job: "PO-8932", status: "Late Risk", progress: 20 }, { job: "PO-8936", status: "Scheduled", progress: 0 }] },
]

export function PlanningBoard() {
    return (
        <Card className="h-full flex flex-col border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-black bg-zinc-50 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Papan Perencanaan (Planning Board)</CardTitle>
                        <CardDescription>Gantt Chart & Machine Loading</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Badge variant="outline" className="bg-white">Shift 1 (07:00 - 15:00)</Badge>
                        <Badge variant="secondary">Shift 2 (15:00 - 23:00)</Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                {/* 2.1 Timeline (Gantt-ish) */}
                <div className="p-4 border-b border-black/10 bg-white">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Active Work Orders Timeline</h4>
                    <div className="space-y-4">
                        {activePOs.map((po) => (
                            <div key={po.id} className="grid grid-cols-12 gap-4 items-center">
                                {/* PO Info */}
                                <div className="col-span-3">
                                    <div className="font-semibold text-sm">{po.id}</div>
                                    <div className="text-xs text-muted-foreground truncate" title={po.product}>{po.product}</div>
                                </div>

                                {/* Stages Bar */}
                                <div className="col-span-9 relative h-8 bg-zinc-100 dark:bg-zinc-800 rounded-md flex items-center px-1">
                                    {/* Simple visual representation of progress */}
                                    <div
                                        className={`h-6 rounded text-[10px] text-white flex items-center justify-center relative group cursor-pointer transition-all
                                    ${po.status === 'Late' ? 'bg-red-500 w-[60%]' :
                                                po.status === 'Risk' ? 'bg-orange-500 w-[85%]' :
                                                    'bg-blue-500 w-[40%]'}
                                `}
                                    >
                                        <span className="font-bold px-2 truncate">{po.stage} ({po.progress}%)</span>

                                        {/* Hover Tooltip (Custom for demo) */}
                                        {po.delay && (
                                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-xs p-2 rounded shadow-lg z-50 whitespace-nowrap hidden group-hover:block">
                                                <div className="font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-yellow-500" /> Issue: {po.delay}</div>
                                                <div>Est. Finish: Tomorrow 10:00 (Delayed)</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Remaining track */}
                                    <div className="flex-1 border-l ml-1 pl-2 text-[10px] text-zinc-400">
                                        Est. Delivery: {po.status === 'Late' ? 'Active Delay' : 'On Schedule'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2.2 Machine Loading Grid */}
                <div className="p-4 flex-1 overflow-auto bg-zinc-50/50 dark:bg-zinc-900/10">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Machine Schedule (Today)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {machineSchedule.map((ms, idx) => (
                            <div key={idx} className="bg-white border border-black rounded-lg p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="font-semibold text-sm">{ms.machine}</div>
                                    <Badge variant="outline" className="text-[10px]">Auto</Badge>
                                </div>
                                <div className="space-y-2">
                                    {ms.shifts.map((shift, sIdx) => (
                                        <div
                                            key={sIdx}
                                            className={`
                                        p-2 rounded text-xs border border-l-4 cursor-pointer hover:opacity-80 transition-opacity
                                        ${shift.status === 'Running' ? 'bg-blue-50 border-blue-500 border-l-blue-500 text-blue-700' :
                                                    shift.status === 'Late Risk' ? 'bg-red-50 border-red-500 border-l-red-500 text-red-700' :
                                                        shift.status === 'Idle' ? 'bg-zinc-100 border-zinc-300 border-l-zinc-300 text-zinc-500 border-dashed' :
                                                            'bg-green-50 border-green-500 border-l-green-500 text-green-700'}
                                    `}
                                        >
                                            <div className="font-bold mb-0.5">{shift.job}</div>
                                            <div className="flex justify-between items-center">
                                                <span>{shift.status}</span>
                                                {shift.status !== 'Idle' && <span>{shift.progress}%</span>}
                                            </div>
                                        </div>
                                    ))}
                                    {/* Add Job Slot */}
                                    <div className="p-2 rounded border border-dashed text-xs text-center text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                                        + Add Job
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
