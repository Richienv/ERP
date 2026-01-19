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


interface RitchieSDMCardProps {
    data: any
}

export function RitchieSDMCard({ data }: RitchieSDMCardProps) {
    // data = { attendanceRate, presentCount, lateCount, totalStaff, topEmployees: [] }
    const employees = data?.topEmployees || []

    const formatIDR = (val: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0
        }).format(val)
    }

    return (
        <div className="h-full group/card">
            <Card className="h-full flex flex-col border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white dark:bg-black hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-200">

                <CardHeader className="pb-3 border-b border-black bg-zinc-50 dark:bg-zinc-900 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
                        <Users className="h-5 w-5 text-indigo-600" />
                        Key Personnel
                    </CardTitle>
                    <Badge variant="outline" className="bg-white text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        Top Performers
                    </Badge>
                </CardHeader>
                <CardContent className="p-0 flex-1 flex flex-col">
                    {/* Header Stats */}
                    <div className="flex items-center justify-between px-4 py-3 bg-zinc-50/50 border-b border-black/5">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Attendance</span>
                            <Badge className="h-5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200 text-[10px] font-bold">{data?.attendanceRate}% Present</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Active Staff</span>
                            <span className="text-sm font-black">{data?.totalStaff}</span>
                        </div>
                    </div>

                    {/* Employee List */}
                    <div className="flex-1 overflow-auto">
                        <div className="divide-y divide-black/5">
                            {employees.map((emp: any, i: number) => (
                                <div key={emp.id || i} className="p-3 hover:bg-zinc-50 transition-colors group/item block">
                                    <div className="flex items-start justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-8 w-8 border border-black/10">
                                                <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold text-xs">
                                                    {emp.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-bold text-sm leading-none group-hover/item:text-indigo-600 transition-colors">{emp.name}</p>
                                                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{emp.position}</p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className={`text-[10px] shadow-sm ${emp.attendance === 'Late' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                emp.attendance === 'Present' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    'bg-zinc-100 text-zinc-500 border-zinc-200'
                                            }`}>
                                            {emp.attendance}
                                        </Badge>
                                    </div>

                                    <div className="pl-10 grid grid-cols-2 gap-2 mt-2">
                                        <div>
                                            <span className="text-[10px] text-muted-foreground font-bold uppercase block">Salary</span>
                                            <span className="text-xs font-mono font-medium text-foreground">{formatIDR(emp.salary)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-muted-foreground font-bold uppercase block">Active Task</span>
                                            <div className="flex items-center gap-1 text-xs font-medium text-foreground truncate">
                                                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                                                {emp.currentTask}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-3 border-t border-black/10 bg-zinc-50 text-center">
                        <Link href="/hcm" className="text-xs font-bold text-muted-foreground hover:text-indigo-600 flex items-center justify-center transition-colors">
                            View Human Capital Dashboard <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                    </div>

                </CardContent>
            </Card>
        </div>
    )
}
