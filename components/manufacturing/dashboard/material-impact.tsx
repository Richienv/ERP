"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Package, AlertCircle, RefreshCw } from "lucide-react"

export function MaterialImpactPanel() {

    return (
        <Card className="h-full border border-border shadow-sm rounded-xl overflow-hidden bg-white dark:bg-slate-900 flex flex-col">
            <CardHeader className="pb-3 border-b border-border bg-zinc-50 dark:bg-zinc-900">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4 text-purple-600" /> Material Impact
                </CardTitle>
                <CardDescription className="text-xs font-medium text-muted-foreground">Linked to: <strong>PO-8932</strong></CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto">
                <div className="p-4 space-y-4">
                    {/* Material Item - OK */}
                    <div className="flex items-start justify-between pb-3 border-b">
                        <div>
                            <p className="text-sm font-medium">Cotton Combed 30s</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Need: 1,000 kg</p>
                        </div>
                        <div className="text-right">
                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">OK</Badge>
                            <p className="text-xs text-muted-foreground mt-1">Stock: 1,200 kg</p>
                        </div>
                    </div>

                    {/* Material Item - Low Stock */}
                    <div className="flex items-start justify-between pb-3 border-b">
                        <div>
                            <p className="text-sm font-medium">Polyester Yarn</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Need: 500 kg</p>
                        </div>
                        <div className="text-right">
                            <Badge variant="destructive" className="h-5 text-xs">Stok Rendah</Badge>
                            <p className="text-xs text-red-500 font-medium mt-1">Stock: 450 kg</p>
                        </div>
                    </div>

                    {/* Material Item - Warning */}
                    <div className="flex items-start justify-between pb-3 border-b">
                        <div>
                            <p className="text-sm font-medium">Indigo Blue Dye</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Need: 120 L</p>
                        </div>
                        <div className="text-right">
                            <Badge variant="outline" className="text-blue-500 border-blue-200 bg-blue-50">Warning</Badge>
                            <p className="text-xs text-muted-foreground mt-1">Stock: 156 L</p>
                        </div>
                    </div>
                </div>

                {/* Action Area */}
                <div className="p-4 bg-red-50 dark:bg-red-900/10 m-4 rounded-lg border border-border shadow-sm">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-red-700">Shortage Alert!</p>
                            <p className="text-xs text-red-600 mt-1 mb-2">Polyester Yarn kurang 50kg. Lead time: 5 hari.</p>
                            <Button size="sm" variant="destructive" className="w-full text-xs h-7 border border-border shadow-sm active:shadow-none transition-all">Create PO (800kg)</Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
