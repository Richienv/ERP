import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, TrendingUp, Users } from "lucide-react"

export function PerformanceWidget() {
    return (
        <Card className="col-span-1 md:col-span-2">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    Performa & Top Talent
                </CardTitle>
                <CardDescription>Evaluasi kinerja Q4 2025</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border">
                        <p className="text-xs text-muted-foreground mb-1">Rata-rata Skor</p>
                        <div className="flex items-end gap-2">
                            <span className="text-2xl font-bold">4.2</span>
                            <span className="text-xs text-green-600 font-medium mb-1">↑ 0.3</span>
                        </div>
                        <div className="w-full bg-zinc-200 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div className="bg-emerald-500 h-full" style={{ width: '84%' }} />
                        </div>
                    </div>
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border">
                        <p className="text-xs text-muted-foreground mb-1">Review Selesai</p>
                        <div className="flex items-end gap-2">
                            <span className="text-2xl font-bold">85%</span>
                            <span className="text-xs text-muted-foreground mb-1">132/156</span>
                        </div>
                        <div className="w-full bg-zinc-200 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div className="bg-blue-500 h-full" style={{ width: '85%' }} />
                        </div>
                    </div>
                </div>

                <div>
                    <h4 className="text-xs font-semibold mb-3">Top Performer (Department)</h4>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Sales</span>
                            <div className="flex items-center gap-2">
                                <span className="font-medium">Andi Wijaya</span>
                                <Badge variant="outline" className="text-[10px] h-5">4.9</Badge>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Engineering</span>
                            <div className="flex items-center gap-2">
                                <span className="font-medium">Sarah Tan</span>
                                <Badge variant="outline" className="text-[10px] h-5">4.8</Badge>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Production</span>
                            <div className="flex items-center gap-2">
                                <span className="font-medium">Budi Santoso</span>
                                <Badge variant="outline" className="text-[10px] h-5">4.7</Badge>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
