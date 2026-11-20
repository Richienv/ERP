"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Package, AlertCircle, ArrowRight, Box, BarChart3, TrendingUp, History, MapPin, Activity, Clock } from "lucide-react"
import Link from "next/link"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"


interface MaterialTrackingCardProps {
    data: any[]
}

export function MaterialTrackingCard({ data }: MaterialTrackingCardProps) {
    const [selectedItem, setSelectedItem] = useState<any>(null)
    const [isOpen, setIsOpen] = useState(false)

    // Data from server: { id, orderId, name, stock, status, warehouse, lastRestock }
    const materials = data.map(m => ({
        ...m,
        color: m.status === 'Critical' ? 'text-red-600' : m.status === 'Low Stock' ? 'text-amber-600' : 'text-emerald-600',
        bg: m.status === 'Critical' ? 'bg-red-50' : m.status === 'Low Stock' ? 'bg-amber-50' : 'bg-emerald-50'
    }))


    const handleItemClick = (item: any) => {
        setSelectedItem(item)
        setIsOpen(true)
    }

    return (
        <div className="h-full group/card">
            <Card className="h-full flex flex-col border border-border shadow-sm rounded-xl overflow-hidden bg-white dark:bg-slate-900 hover:shadow-sm transition-all duration-200">
                <CardHeader className="pb-3 border-b border-border bg-zinc-50 dark:bg-zinc-900 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Package className="h-5 w-5 text-purple-600" />
                        Tracking Bahan Baku
                    </CardTitle>
                    <Badge variant="outline" className="bg-white text-black border-border shadow-sm">
                        1 Alert
                    </Badge>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                    <ScrollArea className="h-[400px]">
                        <div className="divide-y divide-black/5">
                            {materials.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => handleItemClick(item)}
                                    className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors cursor-pointer group/item"
                                >
                                    <div>
                                        <p className="font-bold text-sm group-hover/item:text-purple-600 transition-colors">{item.name}</p>
                                        <p className="text-xs text-muted-foreground mt-1">Stock: {item.stockLevel} {item.unit}</p>
                                    </div>
                                    <Badge variant="outline" className={`border-border shadow-sm ${item.bg} ${item.color}`}>
                                        {item.status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                    <div className="p-4 bg-zinc-50 border-t border-black/10 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">Real-time Stock</span>
                        <Link href="/inventory">
                            <div className="flex items-center text-xs font-bold text-muted-foreground hover:text-purple-600 transition-colors cursor-pointer">
                                View Inventory <ArrowRight className="ml-1 h-3 w-3" />
                            </div>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {/* Detail Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-xl border border-border shadow-sm bg-white p-0 overflow-hidden gap-0">
                    <DialogHeader className="p-6 bg-zinc-50 border-b border-border">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" className={`bg-white border-border ${selectedItem?.color} text-xs`}>{selectedItem?.status}</Badge>
                                    <span className="text-xs font-mono text-muted-foreground">SKU: MAT-{selectedItem?.id}024</span>
                                </div>
                                <DialogTitle className="text-2xl font-semibold tracking-tight leading-none">{selectedItem?.name}</DialogTitle>
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-bold text-muted-foreground ">Current Value</span>
                                <div className="text-xl font-semibold text-foreground">Rp 24.5M</div>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="p-6 space-y-6">
                        {/* 1. Inventory Health Cards */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 border border-black/10 rounded-xl bg-zinc-50 space-y-1">
                                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                                    <Box className="h-3 w-3" /> Stock Level
                                </span>
                                <p className="text-2xl font-semibold text-foreground">{selectedItem?.stockLevel}</p>
                                <span className="text-xs text-green-600 font-bold flex items-center">
                                    <TrendingUp className="h-3 w-3 mr-1" /> Healthy
                                </span>
                            </div>
                            <div className="p-4 border border-black/10 rounded-xl bg-zinc-50 space-y-1">
                                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                                    <Activity className="h-3 w-3" /> Burn Rate
                                </span>
                                <p className="text-2xl font-semibold text-foreground">45kg<span className="text-sm text-muted-foreground font-medium">/day</span></p>
                            </div>
                            <div className="p-4 border border-black/10 rounded-xl bg-red-50 border-red-100 space-y-1">
                                <span className="text-xs font-bold text-red-800 flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> Days Left
                                </span>
                                <p className="text-2xl font-semibold text-red-900">26 Days</p>
                            </div>
                        </div>

                        {/* 2. Supplier & Location Info */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-muted-foreground border-b border-black/5 pb-2">Logistics Chain</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-xs font-bold text-muted-foreground mb-1 block">Primary Vendor</span>
                                    <p className="font-bold text-sm">PT. IndoTextile Utama</p>
                                    <Badge variant="outline" className="mt-1 text-xs bg-emerald-50 text-emerald-700 border-emerald-200">98% On-Time</Badge>
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-muted-foreground mb-1 block">Storage Location</span>
                                    <div className="flex items-center gap-2 font-medium text-sm">
                                        <MapPin className="h-4 w-4 text-purple-500" />
                                        {selectedItem?.warehouse}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-zinc-50 border-t border-border gap-3">
                        <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1 border-border font-bold h-12  ">Close</Button>
                        <Link href={`/inventory/products/${selectedItem?.id}`} className="flex-1">
                            <Button className="w-full bg-slate-900 text-white hover:bg-zinc-800 border border-border shadow-sm active:shadow-none font-semibold h-12 transition-all">
                                Restock Now
                            </Button>
                        </Link>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
