"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, PackageCheck, Users, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";

export function GlobalKPIs() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-card border-border/50 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Order Siap Kirim</CardTitle>
                    <Truck className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-foreground">1,248</div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center">
                        <span className="text-emerald-500 flex items-center mr-1"><ArrowUpRight className="h-3 w-3" /> +12%</span> hari ini
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-card border-border/50 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Penerimaan (Inbound)</CardTitle>
                    <PackageCheck className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-foreground">342</div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center">
                        <span className="text-emerald-500 flex items-center mr-1"><ArrowUpRight className="h-3 w-3" /> +5%</span> dari target
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-card border-border/50 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-bl-full -mr-4 -mt-4" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Operator Aktif</CardTitle>
                    <Users className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-foreground">64 <span className="text-sm font-normal text-muted-foreground">/ 70</span></div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Tersebar di 3 Gudang
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-card border-border/50 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-bl-full -mr-4 -mt-4" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">On-Time Shipping</CardTitle>
                    <Clock className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-foreground">98.5%</div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center">
                        <span className="text-rose-500 flex items-center mr-1"><ArrowDownRight className="h-3 w-3" /> -0.5%</span> dari kemarin
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
