"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react"
import Link from "next/link"

export function QualityTrackingCard() {
    return (
        <Link href="/manufacturing" className="block h-full group hover:no-underline cursor-pointer">
            <Card className="h-full flex flex-col border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white dark:bg-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200">
                <CardHeader className="pb-3 border-b border-black bg-zinc-50 dark:bg-zinc-900 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        Quality Control
                    </CardTitle>
                    <Badge variant="outline" className="bg-white text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        98.5% Pass
                    </Badge>
                </CardHeader>
                <CardContent className="p-4 flex-1 space-y-4">
                    {/* Main Stats */}
                    <div className="flex items-center justify-between p-3 bg-zinc-50 border border-black rounded-lg shadow-sm">
                        <span className="text-sm font-bold text-muted-foreground">Today's Rate</span>
                        <span className="text-3xl font-black text-emerald-600">98.5%</span>
                    </div>

                    {/* Recent Inspections List */}
                    <div className="space-y-3">
                        <p className="text-xs font-black uppercase text-muted-foreground tracking-wider">Latest Inspections</p>

                        <div className="flex items-center justify-between p-2 border-b border-black/5 hover:bg-zinc-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                <div>
                                    <p className="font-bold text-xs">Batch #4092</p>
                                    <p className="text-[10px] text-muted-foreground">Cotton 30s • 2m ago</p>
                                </div>
                            </div>
                            <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-800">Pass</Badge>
                        </div>

                        <div className="flex items-center justify-between p-2 border-b border-black/5 hover:bg-zinc-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <XCircle className="h-4 w-4 text-red-500" />
                                <div>
                                    <p className="font-bold text-xs">Batch #4091</p>
                                    <p className="text-[10px] text-muted-foreground">Dyeing Navy • 15m ago</p>
                                </div>
                            </div>
                            <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-800">Fail</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 border-b border-black/5 hover:bg-zinc-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                <div>
                                    <p className="font-bold text-xs">Batch #4090</p>
                                    <p className="text-[10px] text-muted-foreground">Cotton 24s • 45m ago</p>
                                </div>
                            </div>
                            <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-800">Pass</Badge>
                        </div>
                    </div>

                    <div className="pt-2 flex items-center justify-center text-xs font-bold text-muted-foreground group-hover:text-emerald-600 transition-colors">
                        View Full Report <ArrowRight className="ml-1 h-3 w-3" />
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}
