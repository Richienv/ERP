"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, CheckCircle2, AlertTriangle, Clock } from "lucide-react"

export function ProductionHealth() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Output Health */}
            <Card className="border-l-4 border-l-emerald-500 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-emerald-50/50 dark:bg-emerald-950/10 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Output Hari Ini</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold">18,200 <span className="text-sm font-normal text-muted-foreground">kg</span></h3>
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">91% Target</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Target: 20,000 kg • <span className="text-emerald-600 font-medium">On Track</span></p>
                    </div>
                    <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center">
                        <Activity className="h-5 w-5 text-emerald-600" />
                    </div>
                </CardContent>
            </Card>

            {/* On-Time Delivery Health */}
            <Card className="border-l-4 border-l-blue-500 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-blue-50/50 dark:bg-blue-950/10 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">On-Time Performance</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold">92% <span className="text-sm font-normal text-muted-foreground">OTD</span></h3>
                            <Badge variant="destructive" className="h-5">4 Risk</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Total 52 active POs • 4 terlambat</p>
                    </div>
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Clock className="h-5 w-5 text-blue-600" />
                    </div>
                </CardContent>
            </Card>

            {/* Quality Health */}
            <Card className="border-l-4 border-l-orange-500 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-orange-50/50 dark:bg-orange-950/10 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Kualitas (First Pass)</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold">98.5% <span className="text-sm font-normal text-muted-foreground">Pass</span></h3>
                            <span className="text-xs font-medium text-red-500 flex items-center">
                                <AlertTriangle className="h-3 w-3 mr-1" /> 1.2% Defect
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Rework Cost: Rp 2.4jt hari ini</p>
                    </div>
                    <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-orange-600" />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
