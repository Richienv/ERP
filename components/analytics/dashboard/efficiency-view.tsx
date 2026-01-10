"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Badge } from "@/components/ui/badge"
import { Settings, AlertTriangle, Hammer } from "lucide-react"

const oeeData = [
    { week: 'W1', M01: 85, M02: 82, M03: 90, M04: 65 },
    { week: 'W2', M01: 86, M02: 83, M03: 89, M04: 62 },
    { week: 'W3', M01: 88, M02: 85, M03: 91, M04: 58 }, // M04 crashing
    { week: 'W4', M01: 87, M02: 84, M03: 92, M04: 55 },
]

export function EfficiencyCockpit() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Left: OEE Chart */}
            <Card className="lg:col-span-2 shadow-sm">
                <CardHeader>
                    <CardTitle>Efisiensi Produksi (OEE)</CardTitle>
                    <CardDescription>Tren 4 Minggu Terakhir per Mesin</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={oeeData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="week" />
                                <YAxis domain={[0, 100]} />
                                <Tooltip />
                                <Line type="monotone" dataKey="M01" stroke="#2563eb" strokeWidth={2} name="Mesin #01" />
                                <Line type="monotone" dataKey="M02" stroke="#10b981" strokeWidth={2} name="Mesin #02" />
                                <Line type="monotone" dataKey="M03" stroke="#8b5cf6" strokeWidth={2} name="Mesin #03" />
                                <Line type="monotone" dataKey="M04" stroke="#ef4444" strokeWidth={3} name="Mesin #04 (Critical)" dot={{ r: 6, fill: '#ef4444' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Right: Bottleneck Analysis */}
            <Card className="lg:col-span-1 border-l-4 border-l-red-500 shadow-sm bg-red-50/10">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                        <AlertTriangle className="h-5 w-5" />
                        Bottleneck Alert
                    </CardTitle>
                    <CardDescription>Fokus Perhatian: Mesin #04 (Dyeing)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg text-sm">
                        <div className="flex justify-between font-bold text-red-800 dark:text-red-200 mb-1">
                            <span>OEE Saat Ini</span>
                            <span>55% (Drop 10%)</span>
                        </div>
                        <div className="w-full bg-red-200 rounded-full h-2">
                            <div className="bg-red-600 h-2 rounded-full" style={{ width: '55%' }}></div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground">Top Downtime Reasons</h4>
                        <div className="flex justify-between text-sm border-b pb-1">
                            <span>Suhu Fluktuatif</span>
                            <span className="font-bold">14 jam</span>
                        </div>
                        <div className="flex justify-between text-sm border-b pb-1">
                            <span>Nozzle Clog</span>
                            <span className="font-bold">6 jam</span>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                        <Button className="w-full bg-red-600 hover:bg-red-700 text-white" size="sm">
                            <Hammer className="mr-2 h-4 w-4" /> Notify Maintenance
                        </Button>
                        <Button variant="outline" className="w-full" size="sm">
                            Show Affected Orders (5)
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
