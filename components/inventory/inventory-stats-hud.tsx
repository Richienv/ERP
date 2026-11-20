
import { Card, CardContent } from "@/components/ui/card"
import { Archive, AlertTriangle, DollarSign, ArrowDownToLine, PackageX } from "lucide-react"
import { InventoryKPIs } from "@/lib/types"

interface InventoryStatsHudProps {
    data: InventoryKPIs
}

export function InventoryStatsHud({ data }: InventoryStatsHudProps) {
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-border shadow-sm bg-blue-50">
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold mb-1 text-black">Total Valuation</p>
                        <h3 className="text-xl md:text-2xl font-semibold text-black">{formatCurrency(data.totalValue)}</h3>
                    </div>
                    <div className="h-10 w-10 border border-border bg-white rounded-full flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-black" />
                    </div>
                </CardContent>
            </Card>

            <Card className="border-border shadow-sm bg-white">
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold mb-1 text-muted-foreground">Active SKUs</p>
                        <h3 className="text-xl md:text-2xl font-semibold text-black">{data.totalSKUs}</h3>
                    </div>
                    <div className="h-10 w-10 border border-border bg-zinc-100 rounded-full flex items-center justify-center">
                        <Archive className="h-5 w-5 text-black" />
                    </div>
                </CardContent>
            </Card>

            <Card className={`border-border shadow-sm ${data.lowStockCount > 0 ? 'bg-amber-100' : 'bg-white'}`}>
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold mb-1 text-black">
                            Low Stock Alerts
                        </p>
                        <h3 className="text-xl md:text-2xl font-semibold text-black">
                            {data.lowStockCount} <span className="text-sm font-bold text-black/60">Items</span>
                        </h3>
                    </div>
                    <div className={`h-10 w-10 border border-border rounded-full flex items-center justify-center ${data.lowStockCount > 0 ? 'bg-amber-200' : 'bg-zinc-100'}`}>
                        <AlertTriangle className="h-5 w-5 text-black" />
                    </div>
                </CardContent>
            </Card>

            <Card className={`border-border shadow-sm ${data.pendingInbound > 0 ? 'bg-emerald-100' : 'bg-white'}`}>
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold mb-1 text-black">Pending Inbound</p>
                        <h3 className="text-xl md:text-2xl font-semibold text-black">{data.pendingInbound} <span className="text-sm font-bold text-black/60">Orders</span></h3>
                    </div>
                    <div className="h-10 w-10 border border-border bg-emerald-200 rounded-full flex items-center justify-center">
                        <ArrowDownToLine className="h-5 w-5 text-black" />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
