"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, CalendarDays, Award, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function RitchieSDMCard() {
    return (
        <Link href="/hcm" className="block h-full group hover:no-underline cursor-pointer">
            <Card className="h-full flex flex-col border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white dark:bg-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200">
                <CardHeader className="pb-3 border-b border-black bg-zinc-50 dark:bg-zinc-900 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
                        <Users className="h-5 w-5 text-indigo-600" />
                        Manajemen SDM
                    </CardTitle>
                    <Badge variant="outline" className="bg-white text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        95% Hadir
                    </Badge>
                </CardHeader>
                <CardContent className="p-4 flex-1 space-y-5">

                    {/* Attendance Gauge */}
                    <div className="flex items-center gap-4 p-3 border border-black rounded-lg bg-zinc-50 shadow-sm">
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

                    {/* Active Shift */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold uppercase text-muted-foreground tracking-wider">
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
                    <div className="pt-2 flex items-center justify-center text-xs font-bold text-muted-foreground group-hover:text-indigo-600 transition-colors">
                        Manage Shifts <ArrowRight className="ml-1 h-3 w-3" />
                    </div>

                </CardContent>
            </Card>
        </Link>
    )
}
