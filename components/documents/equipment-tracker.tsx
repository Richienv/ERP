"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileCheck, Wrench, AlertTriangle, Calendar, Download } from "lucide-react"

export function EquipmentTracker() {
    return (
        <Card className="col-span-1 shadow-sm border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
                <div className="flex justify-between">
                    <div>
                        <CardTitle className="text-lg">Equipment Doc Center</CardTitle>
                        <CardDescription>CNC Milling Machine #3 (MILL-003)</CardDescription>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none h-6">🟢 Operational</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">

                {/* Critical Alerts */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <h4 className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase mb-2 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Upcoming Action
                    </h4>
                    <div className="flex justify-between items-center text-sm">
                        <span>Calibration Due</span>
                        <span className="font-bold text-amber-700 dark:text-amber-400">in 8 Days (Jan 17)</span>
                    </div>
                </div>

                {/* Document List */}
                <div className="space-y-3">
                    {/* Calibration */}
                    <div className="flex items-center justify-between p-2 border rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                                <FileCheck className="h-4 w-4" />
                            </div>
                            <div>
                                <div className="font-medium text-sm">Calibration Cert</div>
                                <div className="text-[10px] text-muted-foreground">Valid until Jan 17, 2026</div>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-indigo-600">
                            <Download className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Maintenance Log */}
                    <div className="flex items-center justify-between p-2 border rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                <Wrench className="h-4 w-4" />
                            </div>
                            <div>
                                <div className="font-medium text-sm">Maintenance Log</div>
                                <div className="text-[10px] text-muted-foreground">Last: Jan 3 (Oil Change)</div>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-indigo-600">
                            <Download className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <Button className="w-full" variant="outline">
                    <Calendar className="mr-2 h-4 w-4" /> Schedule Calibration
                </Button>
            </CardContent>
        </Card>
    )
}
