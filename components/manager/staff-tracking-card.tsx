"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { User, Activity, CheckCircle2, AlertCircle } from "lucide-react"

import Link from "next/link"

export function StaffTrackingCard() {
    // Mock data for factory staff
    const staff = [
        {
            id: 1,
            name: "Asep Sunandar",
            role: "Operator Line 1",
            status: "active", // active, break, offline
            currentTask: "Running Weaving Machine #4",
            efficiency: "94%",
            shift: "Morning (07:00 - 15:00)",
            avatar: "AS"
        },
        {
            id: 2,
            name: "Budi Santoso",
            role: "Maintenance Technician",
            status: "busy",
            currentTask: "Repairing Dyeing Machine #2",
            efficiency: "N/A",
            shift: "Morning (07:00 - 15:00)",
            avatar: "BS"
        },
        {
            id: 3,
            name: "Siti Aminah",
            role: "QC Inspector",
            status: "active",
            currentTask: "Inspecting Batch #4567",
            efficiency: "98%",
            shift: "Morning (07:00 - 15:00)",
            avatar: "SA"
        },
        {
            id: 4,
            name: "Doni Pratama",
            role: "Forklift Driver",
            status: "break",
            currentTask: "On Break (12:00 - 13:00)",
            efficiency: "88%",
            shift: "Morning (07:00 - 15:00)",
            avatar: "DP"
        },
        {
            id: 5,
            name: "Rina Wati",
            role: "Operator Line 2",
            status: "active",
            currentTask: "Monitoring Knitting Patterns",
            efficiency: "91%",
            shift: "Morning (07:00 - 15:00)",
            avatar: "RW"
        },
        {
            id: 6,
            name: "Joko Anwar",
            role: "Operator Dyeing",
            status: "active",
            currentTask: "Mixing Chemicals",
            efficiency: "95%",
            shift: "Morning (07:00 - 15:00)",
            avatar: "JA"
        },
    ]

    return (
        <Link href="/hcm" className="block h-full group hover:no-underline cursor-pointer">
            <Card className="h-full flex flex-col border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white dark:bg-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200">
                <CardHeader className="pb-3 border-b border-black bg-zinc-50 dark:bg-zinc-900 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
                        <User className="h-5 w-5 text-blue-600" />
                        Aktivitas Terbaru
                    </CardTitle>
                    <Badge variant="outline" className="bg-white text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        142 Active
                    </Badge>
                </CardHeader>
                <CardContent className="p-0 flex-1 min-h-[400px]">
                    <ScrollArea className="h-full max-h-[500px]">
                        <div className="divide-y">
                            {staff.map((employee) => (
                                <div
                                    key={employee.id}
                                    className="w-full text-left p-4 hover:bg-muted/50 transition-colors group flex items-start gap-4"
                                >
                                    <div className="relative">
                                        <Avatar className="h-10 w-10 border">
                                            <AvatarFallback>{employee.avatar}</AvatarFallback>
                                        </Avatar>
                                        <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background 
                                        ${employee.status === 'active' ? 'bg-emerald-500' :
                                                employee.status === 'busy' ? 'bg-amber-500' :
                                                    'bg-slate-400'}`}
                                        />
                                    </div>

                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-sm">{employee.name}</span>
                                            <span className="text-xs text-muted-foreground">{employee.shift}</span>
                                        </div>
                                        <div className="text-xs font-medium text-muted-foreground">{employee.role}</div>

                                        <div className="flex items-center gap-2 pt-1">
                                            {employee.status === 'active' || employee.status === 'busy' ? (
                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal bg-blue-50 text-blue-700 hover:bg-blue-100">
                                                    <Activity className="h-3 w-3 mr-1" />
                                                    {employee.currentTask}
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal bg-slate-100 text-slate-600">
                                                    ⏸ {employee.currentTask}
                                                </Badge>
                                            )}

                                            {employee.efficiency !== "N/A" && (
                                                <span className={`text-xs font-bold ${parseInt(employee.efficiency) >= 90 ? 'text-emerald-600' : 'text-amber-600'
                                                    }`}>
                                                    Eff: {employee.efficiency}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </Link >
    )
}
