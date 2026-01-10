"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Truck, PackageCheck, AlertTriangle, Activity, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WarehouseCardProps {
    name: string;
    manager: string;
    staffActive: number;
    tasksPending: number;
    ordersToPick: number;
    ordersShipped: number;
    receiptsOpen: number;
    stockAccuracy: number;
    lowStockItems: number;
    capacity: number;
}

export function WarehouseCard({
    name, manager, staffActive, tasksPending,
    ordersToPick, ordersShipped, receiptsOpen,
    stockAccuracy, lowStockItems, capacity
}: WarehouseCardProps) {
    return (
        <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-shadow group">
            <CardHeader className="pb-3 border-b border-border/40 bg-secondary/20">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg font-bold text-foreground">{name}</CardTitle>
                        <CardDescription className="text-xs mt-1">PIC: {manager}</CardDescription>
                    </div>
                    <Badge variant={tasksPending > 50 ? "destructive" : "outline"} className="ml-2">
                        {tasksPending} Task Pending
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">

                {/* Staff & Workload */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="flex items-center text-muted-foreground"><Users className="mr-2 h-4 w-4" /> Staff Aktif</span>
                        <span className="font-medium">{staffActive} Org</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="flex items-center text-muted-foreground"><Activity className="mr-2 h-4 w-4" /> Produktivitas</span>
                        <span className="font-medium text-emerald-600">High</span>
                    </div>
                </div>

                {/* Operations Today */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-secondary/30 p-2 rounded-lg text-center">
                        <div className="text-xs text-muted-foreground mb-1">Picking</div>
                        <div className="font-bold text-lg text-blue-600">{ordersToPick}</div>
                        <div className="text-[10px] text-muted-foreground">Order</div>
                    </div>
                    <div className="bg-secondary/30 p-2 rounded-lg text-center">
                        <div className="text-xs text-muted-foreground mb-1">Shipped</div>
                        <div className="font-bold text-lg text-emerald-600">{ordersShipped}</div>
                        <div className="text-[10px] text-muted-foreground">Order</div>
                    </div>
                </div>

                {/* Capacity & Health */}
                <div className="space-y-3">
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Kapasitas Gudang</span>
                            <span className="font-medium">{capacity}%</span>
                        </div>
                        <Progress value={capacity} className={`h-2 ${capacity > 90 ? "bg-rose-100 dark:bg-rose-900" : ""}`} />
                    </div>

                    <div className="flex justify-between items-center text-xs pt-2 border-t border-border/40">
                        <span className="text-muted-foreground flex items-center">
                            Akurasi Stok: <span className="ml-1 font-bold text-foreground">{stockAccuracy}%</span>
                        </span>
                        {lowStockItems > 0 && (
                            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                                <AlertTriangle className="mr-1 h-3 w-3" /> {lowStockItems} Item Kritis
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="pt-2">
                    <Button variant="ghost" className="w-full h-8 text-xs group-hover:bg-primary/5">
                        Lihat Detail <ArrowRight className="ml-2 h-3 w-3" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
