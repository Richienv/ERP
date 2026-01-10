"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Package, TrendingUp, TrendingDown, AlertCircle, ShoppingCart, Plus, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"

export function DetailedMaterialTable() {
    // Enhanced Mock Data with "Needed Stock" logic
    const materials = [
        { id: "MAT-001", name: "Cotton Combed 30s", category: "Fabric", stock: 1200, needed: 1500, unit: "kg", trend: "up", consumption: "50kg/day" },
        { id: "MAT-002", name: "Polyester Yarn", category: "Yarn", stock: 450, needed: 1000, unit: "kg", trend: "down", consumption: "80kg/day" },
        { id: "MAT-003", name: "Indigo Blue Dye", category: "Chemical", stock: 156, needed: 500, unit: "L", trend: "down", consumption: "20L/day" },
        { id: "MAT-004", name: "Spandex Thread", category: "Thread", stock: 800, needed: 800, unit: "cones", trend: "stable", consumption: "100 cones/day" },
        { id: "MAT-005", name: "Packing Cartons", category: "Packaging", stock: 5000, needed: 5000, unit: "pcs", trend: "stable", consumption: "200 pcs/day" },
        { id: "MAT-007", name: "YKK Zippers", category: "Accessories", stock: 3200, needed: 4000, unit: "pcs", trend: "up", consumption: "500 pcs/day" },
    ]

    return (
        <Card className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white dark:bg-black mt-6">
            <CardHeader className="p-6 border-b border-black bg-zinc-50 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
                            <Package className="h-5 w-5 text-purple-600" />
                            Material Gap Analysis
                        </CardTitle>
                        <p className="text-sm text-muted-foreground font-medium mt-1">Real-time stock vs. required production needs.</p>
                    </div>
                    <Button variant="outline" className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-white text-black hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all">
                        <ShoppingCart className="mr-2 h-4 w-4" /> Bulk Order
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-zinc-100 dark:bg-zinc-900 border-b border-black/10">
                        <TableRow className="border-b border-black/5 hover:bg-transparent">
                            <TableHead className="font-bold text-black dark:text-white w-[250px]">Material Name</TableHead>
                            <TableHead className="font-bold text-black dark:text-white">Current Stock</TableHead>
                            <TableHead className="font-bold text-black dark:text-white">Required (Min)</TableHead>
                            <TableHead className="font-bold text-black dark:text-white">Gap / Deficit</TableHead>
                            <TableHead className="font-bold text-black dark:text-white">Status</TableHead>
                            <TableHead className="font-bold text-black dark:text-white text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {materials.map((item) => {
                            const deficit = item.needed - item.stock;
                            const isDeficit = deficit > 0;
                            const percentage = Math.round((item.stock / item.needed) * 100);

                            return (
                                <TableRow key={item.id} className="hover:bg-muted/50 transition-colors border-b border-black/5 last:border-0">
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm">{item.name}</span>
                                            <span className="text-xs text-muted-foreground">{item.id} • {item.category}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono font-medium">
                                        {item.stock.toLocaleString()} <span className="text-muted-foreground text-xs">{item.unit}</span>
                                    </TableCell>
                                    <TableCell className="font-mono font-medium text-muted-foreground">
                                        {item.needed.toLocaleString()} <span className="text-xs">{item.unit}</span>
                                    </TableCell>
                                    <TableCell>
                                        {isDeficit ? (
                                            <div className="flex items-center gap-2 text-red-600 font-bold bg-red-50 w-fit px-2 py-1 rounded border border-red-200">
                                                <TrendingDown className="h-3 w-3" />
                                                -{deficit.toLocaleString()} {item.unit}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-emerald-600 font-bold bg-emerald-50 w-fit px-2 py-1 rounded border border-emerald-200">
                                                <TrendingUp className="h-3 w-3" />
                                                Safe
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-16 bg-zinc-100 rounded-full overflow-hidden border border-black/10">
                                                <div
                                                    className={`h-full ${percentage < 50 ? 'bg-red-500' : percentage < 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                    style={{ width: `${Math.min(percentage, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-bold">{percentage}%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <RestockDialog item={item} deficit={deficit} />
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

function RestockDialog({ item, deficit }: { item: any, deficit: number }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className={`
                    border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none
                    ${deficit > 0
                        ? "bg-black text-white hover:bg-zinc-800"
                        : "bg-white text-black hover:bg-zinc-100"}
                `}>
                    {deficit > 0 ? "Restock Now" : "Add Stock"}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-black">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase">
                        <ShoppingCart className="h-5 w-5 text-purple-600" />
                        Restock Request
                    </DialogTitle>
                    <DialogDescription>
                        Create a purchase request for <span className="font-bold text-foreground">{item.name}</span>.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right text-xs font-bold uppercase text-muted-foreground">Current</Label>
                        <div className="col-span-3 font-mono font-bold">{item.stock} {item.unit}</div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right text-xs font-bold uppercase text-muted-foreground">Shortage</Label>
                        <div className="col-span-3 font-mono font-bold text-red-600">
                            {deficit > 0 ? `-${deficit} ${item.unit}` : "None"}
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="quantity" className="text-right">Order Qty</Label>
                        <Input
                            id="quantity"
                            defaultValue={deficit > 0 ? deficit : 100}
                            className="col-span-3 border-black focus-visible:ring-black"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="vendor" className="text-right">Vendor</Label>
                        <Input
                            id="vendor"
                            defaultValue="Preferred Vendor"
                            className="col-span-3 border-black focus-visible:ring-black"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} className="border-black hover:bg-zinc-100">Cancel</Button>
                    <Button type="submit" onClick={() => setOpen(false)} className="bg-purple-600 text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-purple-700 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all">
                        Confirm Order
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
