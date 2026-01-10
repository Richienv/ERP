"use client";

import { useState } from "react";
import {
    Plus,
    Search,
    Filter,
    MoreVertical,
    Shirt,
    Calendar,
    User,
    Clock,
    CheckCircle2,
    AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

// Mock Data for Production Orders
const ORDERS = [
    { id: "PO-001", style: "Classic Blue Jeans", qty: 500, status: "In Progress", producer: "Line A", date: "12/08/2026", cost: 1550000, progress: 65, workers: ["Budi", "Siti", "Joko"] },
    { id: "PO-002", style: "Denim Jacket V2", qty: 200, status: "Pending", producer: "Line B", date: "14/08/2026", cost: 950000, progress: 0, workers: ["Rina"] },
    { id: "PO-003", style: "Slim Fit Chinos", qty: 350, status: "Completed", producer: "Line A", date: "01/08/2026", cost: 1100000, progress: 100, workers: ["Budi", "Sanni"] },
    { id: "PO-004", style: "Cotton T-Shirt Basic", qty: 1000, status: "In Progress", producer: "Line C", date: "15/08/2026", cost: 500000, progress: 30, workers: ["Ahmad", "Dedi"] },
    { id: "PO-005", style: "Cargo Shorts", qty: 400, status: "Pending", producer: "Line B", date: "18/08/2026", cost: 800000, progress: 0, workers: [] },
];

export default function ProductionOrdersPage() {
    const [selectedOrder, setSelectedOrder] = useState<typeof ORDERS[0] | null>(null);

    const formatRupiah = (num: number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num);
    };

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Production Orders</h2>
                    <p className="text-muted-foreground">Track manufacturing progress and cost allocation.</p>
                </div>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Create Order
                </Button>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center flex-1 gap-2 max-w-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search PO#, Style..." className="pl-9" />
                    </div>
                    <Button variant="outline" size="icon">
                        <Filter className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Main Table */}
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">Order #</TableHead>
                            <TableHead>Style / Product</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead>Producer</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {ORDERS.map((order) => (
                            <TableRow
                                key={order.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => setSelectedOrder(order)}
                            >
                                <TableCell className="font-medium">{order.id}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded bg-secondary flex items-center justify-center">
                                            <Shirt className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <span className="font-medium">{order.style}</span>
                                    </div>
                                </TableCell>
                                <TableCell>{order.qty}</TableCell>
                                <TableCell>{order.producer}</TableCell>
                                <TableCell>
                                    <Badge variant={
                                        order.status === "Completed" ? "default" :
                                            order.status === "In Progress" ? "secondary" :
                                                "outline"
                                    } className={order.status === "Completed" ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                                        {order.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Slide-Over Detail Panel */}
            <Sheet open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
                <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                    {selectedOrder && (
                        <>
                            <SheetHeader className="space-y-4 pb-6 border-b">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <SheetTitle className="text-2xl">{selectedOrder.id}: {selectedOrder.qty} Units</SheetTitle>
                                        <SheetDescription>{selectedOrder.style}</SheetDescription>
                                    </div>
                                    <Badge variant="outline" className="text-sm">{selectedOrder.status}</Badge>
                                </div>
                                <div className="flex gap-6 text-sm">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-muted-foreground">Start Date</span>
                                        <span className="font-medium">{selectedOrder.date}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-muted-foreground">Est. Completion</span>
                                        <span className="font-medium">20/08/2026</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-muted-foreground">Progress</span>
                                        <span className="font-medium text-blue-600">{selectedOrder.progress}%</span>
                                    </div>
                                </div>
                            </SheetHeader>

                            <div className="py-6 space-y-8">

                                {/* Allocated Materials Section */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Allocated Materials
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-sm p-3 bg-secondary/30 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 bg-blue-500/10 rounded flex items-center justify-center text-blue-600 font-bold">D</div>
                                                <div>
                                                    <p className="font-medium">Denim Fabric 13oz</p>
                                                    <p className="text-xs text-muted-foreground">1.250 Meters</p>
                                                </div>
                                            </div>
                                            <span className="font-medium">Rp 950.000</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm p-3 bg-secondary/30 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 bg-zinc-500/10 rounded flex items-center justify-center text-zinc-600 font-bold">Z</div>
                                                <div>
                                                    <p className="font-medium">YKK Zippers (Metal)</p>
                                                    <p className="text-xs text-muted-foreground">500 Units</p>
                                                </div>
                                            </div>
                                            <span className="font-medium">Rp 250.000</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm p-3 bg-secondary/30 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 bg-orange-500/10 rounded flex items-center justify-center text-orange-600 font-bold">T</div>
                                                <div>
                                                    <p className="font-medium">Sewing Thread (Navy)</p>
                                                    <p className="text-xs text-muted-foreground">50 Spools</p>
                                                </div>
                                            </div>
                                            <span className="font-medium">Rp 75.000</span>
                                        </div>
                                        <Separator />
                                        <div className="flex justify-between font-bold">
                                            <span>Total Material Cost</span>
                                            <span>Rp 1.275.000</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Cost Breakdown Section */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4 text-blue-500" /> Cost Breakdown
                                    </h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Base Production (Ovt)</span>
                                            <span>Rp 150.000</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Worker Assignments</span>
                                            <span>Rp 125.000</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Profit Emerging</span>
                                            <span className="text-emerald-600">Rp 0 (Est)</span>
                                        </div>
                                        <Separator className="my-2" />
                                        <div className="flex justify-between text-lg font-bold">
                                            <span>Total Cost</span>
                                            <span>{formatRupiah(selectedOrder.cost)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Worker Assignments Section */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <User className="h-4 w-4 text-purple-500" /> Worker Assignments
                                    </h3>
                                    <div className="grid gap-3">
                                        {selectedOrder.workers.length > 0 ? selectedOrder.workers.map((worker, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarFallback className="bg-primary/10 text-primary text-xs">{worker.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="text-sm font-medium">{worker}</p>
                                                        <p className="text-xs text-muted-foreground">Cutting • Sewing</p>
                                                    </div>
                                                </div>
                                                <Badge variant="secondary" className="text-[10px]">Active</Badge>
                                            </div>
                                        )) : (
                                            <p className="text-sm text-muted-foreground italic">No workers assigned yet.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <Button className="w-full">
                                        Update Progress & Costs
                                    </Button>
                                </div>

                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
