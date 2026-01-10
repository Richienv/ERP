"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserMinus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PeopleOverlay() {

    return (
        <Card className="h-full flex flex-col border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white dark:bg-black">
            <CardHeader className="pb-3 border-b border-black bg-zinc-50 dark:bg-zinc-900">
                <CardTitle className="text-base font-black uppercase tracking-wider flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    SDM & Shift
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
                {/* Today Stats */}
                <div className="flex items-center justify-between text-sm">
                    <div className="flex flex-col">
                        <span className="font-bold text-lg">150/156</span>
                        <span className="text-xs text-muted-foreground">Hadir Hari Ini</span>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="font-bold text-lg text-orange-600">8</span>
                        <span className="text-xs text-muted-foreground">Terlambat</span>
                    </div>
                </div>

                {/* Shift Coverage Heatmap (Mock Visual) */}
                <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Shift Coverage Risk</h4>
                    <div className="border rounded-lg overflow-hidden text-xs">
                        <div className="grid grid-cols-3 bg-muted p-1 font-medium text-center">
                            <div>Line</div>
                            <div>Shift 1</div>
                            <div>Shift 2</div>
                        </div>
                        <div className="grid grid-cols-3 p-1 border-t text-center items-center">
                            <div className="text-left pl-2">Weaving</div>
                            <div className="bg-emerald-100 text-emerald-700 rounded py-0.5">OK (12/12)</div>
                            <div className="bg-red-100 text-red-700 rounded py-0.5 cursor-pointer hover:bg-red-200">Lack (2/4)</div>
                        </div>
                        <div className="grid grid-cols-3 p-1 border-t text-center items-center">
                            <div className="text-left pl-2">Dyeing</div>
                            <div className="bg-emerald-100 text-emerald-700 rounded py-0.5">OK (8/8)</div>
                            <div className="bg-yellow-100 text-yellow-700 rounded py-0.5">Risk (7/8)</div>
                        </div>
                    </div>
                </div>

                {/* Pending Leave */}
                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded-lg border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <div className="flex items-start gap-2">
                        <UserMinus className="h-4 w-4 text-yellow-600 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-yellow-700">Peringatan Absensi (Besok)</p>
                            <p className="text-[10px] text-yellow-600/80">3 Operator Weaving Izin. Perlu backup.</p>
                            <Button size="sm" variant="outline" className="h-6 text-[10px] mt-1 bg-white border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:bg-yellow-100 text-yellow-700">Cari Pengganti</Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
