"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { CheckCircle2, XCircle } from "lucide-react"

const qualityData = [
    { name: "Pass", value: 98.5, color: "#10b981" },
    { name: "Defect", value: 1.5, color: "#ef4444" },
]

export function QualityWorkspace() {

    return (
        <Card className="h-full flex flex-col border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white dark:bg-black">
            <CardHeader className="pb-3 border-b border-black bg-zinc-50 dark:bg-zinc-900">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-base font-black uppercase tracking-wider">Manajemen Kualitas</CardTitle>
                    <Badge variant="outline" className="text-[10px] border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">ISO 9001</Badge>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                {/* Left: Chart */}
                <div className="flex flex-col items-center justify-center">
                    <div className="h-[120px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={qualityData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={35}
                                    outerRadius={50}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {qualityData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="text-center mt-[-10px]">
                        <span className="text-2xl font-bold text-emerald-600">98.5%</span>
                        <p className="text-[10px] text-muted-foreground">Pass Rate</p>
                    </div>
                </div>

                {/* Right: Latest Inspections */}
                <div className="space-y-3 overflow-auto max-h-[200px] pr-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Inspeksi Terakhir</h4>
                    <div className="flex items-start gap-3 p-2 bg-white dark:bg-zinc-900 rounded border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold">Batch #9 - Cotton Combed</p>
                            <p className="text-[10px] text-muted-foreground">Lolos • 2 jam lalu • Budi S.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all">
                        <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-red-700">Hasil Pewarnaan - Navy</p>
                            <p className="text-[10px] text-red-600/80">Gagal (Color Deviation) • 4 jam lalu</p>
                            <Button variant="link" className="h-4 px-0 text-[10px] text-red-600 underline">Tindakan: Re-Dye</Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
