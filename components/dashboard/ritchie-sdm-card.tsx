"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, CalendarDays, Award, ArrowRight, UserCog, Clock } from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function RitchieSDMCard() {
    const [isOpen, setIsOpen] = useState(false)

    // Simplified click handler for the whole card content, or specific areas
    const handleShiftClick = () => {
        setIsOpen(true)
    }

    return (
        <div className="h-full group/card">
            <Card className="h-full flex flex-col border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white dark:bg-black hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-200">
                <CardHeader className="pb-3 border-b border-black bg-zinc-50 dark:bg-zinc-900 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
                        <Users className="h-5 w-5 text-indigo-600" />
                        Manajemen SDM
                    </CardTitle>
                    <Badge variant="outline" className="bg-white text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        95% Hadir
                    </Badge>
                </CardHeader>
                <CardContent className="p-4 flex-1 space-y-5 cursor-pointer" onClick={handleShiftClick}>

                    {/* Attendance Gauge - Clickable */}
                    <div className="flex items-center gap-4 p-3 border border-black rounded-lg bg-zinc-50 shadow-sm hover:bg-zinc-100 transition-colors">
                        <div className="relative h-12 w-12 flex items-center justify-center flex-shrink-0">
                            <svg className="absolute inset-0 h-full w-full -rotate-90 text-zinc-200">
                                <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" />
                                <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="text-indigo-600" strokeDasharray="125.6" strokeDashoffset={125.6 * (1 - 0.95)} strokeLinecap="round" />
                            </svg>
                            <span className="text-xs font-black text-foreground">95%</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm">Kehadiran Hari Ini</h4>
                            <div className="flex gap-2 mt-1">
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold border border-emerald-200">135 Tepat</span>
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold border border-amber-200">7 Telat</span>
                            </div>
                        </div>
                    </div>

                    {/* Active Shift - Clickable */}
                    <div className="space-y-2 group/shift">
                        <div className="flex justify-between items-center text-xs font-bold uppercase text-muted-foreground tracking-wider group-hover/shift:text-indigo-600 transition-colors">
                            <span>Shift 1 (Pagi)</span>
                            <Badge className="h-5 bg-indigo-600 text-[10px]">Aktif</Badge>
                        </div>
                        <div className="flex -space-x-2 pl-2">
                            <Avatar className="h-8 w-8 border-2 border-white"><AvatarFallback className="bg-pink-600 text-white text-[10px] font-bold">AD</AvatarFallback></Avatar>
                            <Avatar className="h-8 w-8 border-2 border-white"><AvatarFallback className="bg-blue-600 text-white text-[10px] font-bold">TS</AvatarFallback></Avatar>
                            <Avatar className="h-8 w-8 border-2 border-white"><AvatarFallback className="bg-emerald-600 text-white text-[10px] font-bold">RK</AvatarFallback></Avatar>
                            <div className="h-8 w-8 rounded-full bg-zinc-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-muted-foreground">+45</div>
                        </div>
                    </div>

                    {/* Footer Action */}
                    <div className="pt-2 flex items-center justify-center text-xs font-bold text-muted-foreground">
                        <Link href="/hcm" className="flex items-center hover:text-indigo-600 transition-colors" onClick={(e) => e.stopPropagation()}>
                            Go to HR Portal <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                    </div>

                </CardContent>
            </Card>

            {/* Detail Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-xl border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white p-0 overflow-hidden gap-0">
                    <DialogHeader className="p-6 bg-zinc-50 border-b border-black md:flex-row items-center justify-between space-y-0">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="bg-white border-black text-indigo-700 shadow-sm">Live Shift</Badge>
                                <span className="text-xs font-mono text-muted-foreground">{new Date().toLocaleTimeString()}</span>
                            </div>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight leading-none">Shift 1 - Morning</DialogTitle>
                        </div>
                        <div className="text-right hidden md:block">
                            <span className="text-xs font-bold text-muted-foreground uppercase block mb-1">Labor Cost (Est)</span>
                            <div className="text-xl font-black text-foreground">Rp 12.5M<span className="text-sm font-medium text-muted-foreground">/day</span></div>
                        </div>
                    </DialogHeader>

                    <div className="p-6 space-y-8">
                        {/* 1. Workforce Stats */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative overflow-hidden p-5 border border-black/10 rounded-xl bg-gradient-to-br from-emerald-50 to-white">
                                <div className="absolute top-0 right-0 p-3 opacity-20"><Users className="h-12 w-12 text-emerald-900" /></div>
                                <span className="text-4xl font-black text-emerald-700 block tracking-tight">135</span>
                                <span className="text-xs font-black uppercase text-emerald-900 tracking-wider">Present & Active</span>
                            </div>
                            <div className="relative overflow-hidden p-5 border border-black/10 rounded-xl bg-gradient-to-br from-amber-50 to-white">
                                <div className="absolute top-0 right-0 p-3 opacity-20"><Clock className="h-12 w-12 text-amber-900" /></div>
                                <span className="text-4xl font-black text-amber-700 block tracking-tight">7</span>
                                <span className="text-xs font-black uppercase text-amber-900 tracking-wider">Late / Absent</span>
                            </div>
                        </div>

                        {/* 2. Critical Issues */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b border-black/5 pb-2">Critical Workforce Issues</h4>
                            <div className="bg-white border border-black/10 rounded-lg p-3 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs border border-red-200">!</div>
                                    <div>
                                        <p className="text-sm font-bold">Line 4 Understaffed</p>
                                        <p className="text-[10px] text-muted-foreground">Missing 2 critical operators.</p>
                                    </div>
                                </div>
                                <Badge variant="outline" className="text-[10px] border-red-200 text-red-700 bg-red-50">High Impact</Badge>
                            </div>
                        </div>

                        {/* 3. Supervisor */}
                        <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl border border-black/5">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 border border-black"><AvatarFallback className="bg-black text-white font-bold">AS</AvatarFallback></Avatar>
                                <div>
                                    <p className="text-sm font-black uppercase">Agus Setiawan</p>
                                    <p className="text-xs text-muted-foreground font-medium">Shift Supervisor</p>
                                </div>
                            </div>
                            <Button size="sm" variant="outline" className="h-9 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none bg-white">
                                Contact
                            </Button>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-zinc-50 border-t border-black gap-3">
                        <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1 border-black font-bold h-12 uppercase tracking-wide">Close</Button>
                        <Link href={`/hcm`} className="flex-1">
                            <Button className="w-full bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none font-black h-12 uppercase tracking-wide transition-all">
                                Full HR Report
                            </Button>
                        </Link>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
