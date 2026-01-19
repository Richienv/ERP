
'use client'

import { KanbanProduct } from "@/app/actions/inventory"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"

interface InventoryKanbanBoardProps {
    products: KanbanProduct[]
}

export function InventoryKanbanBoard({ products }: InventoryKanbanBoardProps) {
    const columns = [
        {
            id: 'IN_STOCK',
            title: 'Healthy Stock',
            color: 'bg-emerald-50',
            icon: CheckCircle2,
            iconColor: 'text-emerald-600',
            items: products.filter(p => p.status === 'IN_STOCK')
        },
        {
            id: 'LOW_STOCK',
            title: 'Low Stock Watchlist',
            color: 'bg-amber-50',
            icon: AlertTriangle,
            iconColor: 'text-amber-600',
            items: products.filter(p => p.status === 'LOW_STOCK')
        },
        {
            id: 'CRITICAL',
            title: 'Critical / OOS',
            color: 'bg-red-50',
            icon: XCircle,
            iconColor: 'text-red-600',
            items: products.filter(p => ['CRITICAL', 'OUT_OF_STOCK'].includes(p.status))
        }
    ]

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)
    }

    return (
        <div className="flex gap-6 h-[calc(100vh-280px)] overflow-x-auto pb-4">
            {columns.map(col => (
                <div key={col.id} className="flex-1 min-w-[300px] max-w-[400px] flex flex-col h-full bg-slate-50/50 rounded-lg border border-slate-200">
                    <div className={`p-3 border-b border-slate-200 ${col.color} rounded-t-lg flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                            <col.icon className={`h-4 w-4 ${col.iconColor}`} />
                            <h3 className="font-bold text-sm text-slate-800">{col.title}</h3>
                        </div>
                        <Badge variant="secondary" className="bg-white/80">{col.items.length}</Badge>
                    </div>

                    <ScrollArea className="flex-1 p-3">
                        <div className="space-y-3">
                            {col.items.map(product => (
                                <Card key={product.id} className="shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-white">
                                    <div className="p-3">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-bold text-sm text-slate-800 line-clamp-1">{product.name}</h4>
                                                <p className="text-[10px] text-muted-foreground font-mono">{product.code}</p>
                                            </div>
                                            <Badge variant="outline" className="text-[10px]">{product.category}</Badge>
                                        </div>

                                        <div className="flex items-end justify-between mt-4">
                                            <div>
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Stock</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className={`text-lg font-bold ${product.status === 'IN_STOCK' ? 'text-slate-700' :
                                                        product.status === 'LOW_STOCK' ? 'text-amber-600' : 'text-red-600'
                                                        }`}>
                                                        {product.totalStock}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">{product.unit}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-muted-foreground">Est. Value</p>
                                                <p className="text-xs font-medium text-slate-600">{formatCurrency(product.value)}</p>
                                            </div>
                                        </div>

                                        {/* Mini progress bar for stock vs min */}
                                        <div className="mt-3 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${col.iconColor.replace('text-', 'bg-')}`}
                                                style={{ width: `${Math.min((product.totalStock / (product.minStock * 2)) * 100, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            ))}
        </div>
    )
}
