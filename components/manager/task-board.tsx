"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Plus, Phone, MessageSquare, AlertCircle } from "lucide-react"

export function ManagerTaskBoard() {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-black font-serif tracking-tight flex items-center gap-2">
                    📋 Task Management Center
                </h2>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all">Filter: My Tasks</Button>
                    <Button size="sm" className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]"><Plus className="h-4 w-4 mr-1" /> New Task</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-[600px] overflow-x-auto pb-4">
                {/* Column 1: TO DO */}
                <div className="bg-zinc-50/50 dark:bg-zinc-900/50 p-4 rounded-xl border border-black/10 flex flex-col gap-4 min-w-[300px]">
                    <div className="flex justify-between items-center text-sm font-bold text-muted-foreground uppercase tracking-wider">
                        <span>TO DO (18)</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </div>

                    {/* Task Card: Critical */}
                    <Card className="bg-white dark:bg-zinc-950 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform cursor-pointer rounded-xl">
                        <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <Badge variant="destructive" className="bg-red-600 text-white border-black text-[10px] px-1.5 py-0.5 h-5 shadow-sm">URGENT 🔥</Badge>
                                <span className="text-xs font-mono font-bold text-muted-foreground">#TASK-2456</span>
                            </div>
                            <h3 className="font-bold text-sm leading-tight">Order polyester yarn ASAP</h3>
                            <p className="text-xs text-muted-foreground line-clamp-2 font-medium">Production stopped on Line 2 if not arrived by Monday.</p>

                            <div className="flex items-center justify-between pt-2 border-t border-black/10">
                                <div className="flex -space-x-2">
                                    <Avatar className="h-6 w-6 border-2 border-white dark:border-zinc-900">
                                        <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700 font-bold">PA</AvatarFallback>
                                    </Avatar>
                                </div>
                                <div className="text-xs font-black text-red-600">Due: 5 PM</div>
                            </div>
                            <div className="text-[10px] bg-red-50 dark:bg-red-900/20 text-red-700 font-bold p-1.5 rounded border border-red-100 dark:border-red-900 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                <span>Blocker: Waiting supplier quote</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Task Card: Normal */}
                    <Card className="bg-white dark:bg-zinc-950 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform cursor-pointer rounded-xl">
                        <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <Badge variant="secondary" className="bg-zinc-100 text-zinc-700 border border-black/20 text-[10px] px-1.5 py-0.5 h-5">MAINTENANCE</Badge>
                                <span className="text-xs font-mono font-bold text-muted-foreground">#TASK-2458</span>
                            </div>
                            <h3 className="font-bold text-sm leading-tight">Schedule Line 3 maintenance</h3>
                            <div className="flex items-center justify-between pt-2 border-t border-black/10">
                                <div className="flex -space-x-2">
                                    <Avatar className="h-6 w-6 border-2 border-white dark:border-zinc-900">
                                        <AvatarFallback className="text-[10px] bg-amber-100 text-amber-700 font-bold">PJ</AvatarFallback>
                                    </Avatar>
                                </div>
                                <div className="text-xs text-muted-foreground font-medium">Tomorrow</div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Column 2: IN PROGRESS */}
                <div className="bg-zinc-50/50 dark:bg-zinc-900/50 p-4 rounded-xl border border-black/10 flex flex-col gap-4 min-w-[300px]">
                    <div className="flex justify-between items-center text-sm font-bold text-muted-foreground uppercase tracking-wider">
                        <span>IN PROGRESS (24)</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </div>

                    {/* Task Card: Progress */}
                    <Card className="bg-white dark:bg-zinc-950 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform cursor-pointer rounded-xl">
                        <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-black text-[10px] px-1.5 py-0.5 h-5 shadow-sm">HIGH</Badge>
                                <span className="text-xs font-mono font-bold text-muted-foreground">#TASK-2441</span>
                            </div>
                            <h3 className="font-bold text-sm leading-tight">Fix color defect SO-234</h3>

                            <div className="w-full h-2 bg-zinc-100 border border-black/10 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 border-r border-black/20 w-[85%]" />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground font-medium">
                                <span>85% Done</span>
                                <span>Started: 2:30 PM</span>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-black/10">
                                <div className="flex -space-x-2">
                                    <Avatar className="h-6 w-6 border-2 border-white dark:border-zinc-900">
                                        <AvatarFallback className="text-[10px] bg-pink-100 text-pink-700 font-bold">ID</AvatarFallback>
                                    </Avatar>
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-zinc-100 rounded-full"><Phone className="h-3 w-3" /></Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-zinc-100 rounded-full"><MessageSquare className="h-3 w-3" /></Button>
                                </div>
                            </div>
                            <div className="text-[10px] text-muted-foreground italic bg-zinc-50 p-1.5 rounded border border-black/5">"Redying now, will finish 7PM" - 15m ago</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Column 3: REVIEW */}
                <div className="bg-zinc-50/50 dark:bg-zinc-900/50 p-4 rounded-xl border border-black/10 flex flex-col gap-4 min-w-[300px]">
                    <div className="flex justify-between items-center text-sm font-bold text-muted-foreground uppercase tracking-wider">
                        <span>REVIEW (7)</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </div>
                    <Card className="bg-white dark:bg-zinc-950 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform cursor-pointer rounded-xl">
                        <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <Badge className="bg-blue-600 text-white border-black text-[10px] px-1.5 py-0.5 h-5 shadow-sm">APPROVAL</Badge>
                                <span className="text-xs font-mono font-bold text-muted-foreground">#TASK-2398</span>
                            </div>
                            <h3 className="font-bold text-sm leading-tight">Approve rework plan</h3>
                            <p className="text-xs text-muted-foreground font-medium">Impact: Rp 67M</p>

                            <div className="flex items-center justify-between pt-2 border-t border-black/10">
                                <span className="text-xs font-bold text-blue-600">Assigned: ME (Owner)</span>
                                <Button size="sm" className="h-6 text-[10px] bg-blue-600 hover:bg-blue-700 text-white border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">Review</Button>
                            </div>
                            <div className="text-[10px] text-amber-600 font-bold bg-amber-50 p-1 rounded text-center border border-amber-100">Waiting: 2 hours</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Column 4: COMPLETED */}
                <div className="bg-zinc-50/50 dark:bg-zinc-900/50 p-4 rounded-xl border border-black/10 flex flex-col gap-4 min-w-[300px]">
                    <div className="flex justify-between items-center text-sm font-bold text-muted-foreground uppercase tracking-wider">
                        <span>COMPLETED (156)</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </div>
                    <Card className="bg-zinc-50 dark:bg-zinc-900 border border-black/20 opacity-75 hover:opacity-100 transition-opacity rounded-xl">
                        <CardContent className="p-4 space-y-2">
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-black text-emerald-600 border border-emerald-200 bg-emerald-50 px-1 rounded">✅ TODAY</span>
                                <span className="text-xs font-mono text-muted-foreground">#TASK-2389</span>
                            </div>
                            <h3 className="font-medium text-sm leading-tight decoration-slate-400 line-through text-muted-foreground">Shipped SO-2026-234</h3>
                            <div className="text-xs text-muted-foreground">2000m to PT Mode Fashion</div>
                            <div className="text-[10px] text-muted-foreground border-t border-black/5 pt-1 mt-1 font-medium">
                                By: Warehouse Team • 4:30 PM
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
