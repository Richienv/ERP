"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Package, AlertCircle, ArrowRight } from "lucide-react"
import Link from "next/link"

export function MaterialTrackingCard() {
    const materials = [
        { id: 1, name: "Cotton Combed 30s", status: "OK", stock: "1,200 kg", color: "text-emerald-600", bg: "bg-emerald-50" },
        { id: 2, name: "Polyester Yarn", status: "Low Stock", stock: "450 kg", color: "text-red-600", bg: "bg-red-50" },
        { id: 3, name: "Indigo Blue Dye", status: "Warning", stock: "156 L", color: "text-amber-600", bg: "bg-amber-50" },
        { id: 4, name: "Spandex Thread", status: "OK", stock: "800 cones", color: "text-emerald-600", bg: "bg-emerald-50" },
        { id: 5, name: "Packing Cartons", status: "OK", stock: "5,000 pcs", color: "text-emerald-600", bg: "bg-emerald-50" },
    ]

    return (
        <Link href="/inventory" className="block h-full group hover:no-underline cursor-pointer">
            <Card className="h-full flex flex-col border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white dark:bg-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200">
                <CardHeader className="pb-3 border-b border-black bg-zinc-50 dark:bg-zinc-900 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
                        <Package className="h-5 w-5 text-purple-600" />
                        Tracking Bahan Baku
                    </CardTitle>
                    <Badge variant="outline" className="bg-white text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        1 Alert
                    </Badge>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                    <ScrollArea className="h-[400px]">
                        <div className="divide-y divide-black/5">
                            {materials.map((item) => (
                                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                                    <div>
                                        <p className="font-bold text-sm">{item.name}</p>
                                        <p className="text-xs text-muted-foreground mt-1">Stock: {item.stock}</p>
                                    </div>
                                    <Badge variant="outline" className={`border-black shadow-sm ${item.bg} ${item.color}`}>
                                        {item.status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-zinc-50 border-t border-black/10 flex items-center justify-center text-xs font-bold text-muted-foreground group-hover:text-purple-600 transition-colors">
                            View All Inventory <ArrowRight className="ml-1 h-3 w-3" />
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </Link>
    )
}
