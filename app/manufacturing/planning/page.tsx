"use client";

import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Download,
    Layers,
    TrendingUp,
    AlertCircle,
    Calendar as CalendarIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

const SCHEDULE = [
    { week: "W1 - Jan", demand: 12000, production: 12500, status: "On Track", capacity: 85 },
    { week: "W2 - Jan", demand: 15000, production: 14000, status: "Deficit", capacity: 95 },
    { week: "W3 - Jan", demand: 11000, production: 11000, status: "On Track", capacity: 70 },
    { week: "W4 - Jan", demand: 18000, production: 16000, status: "Risk", capacity: 100 },
];

const FORECAST = [
    { title: "Kemeja Flanel (Q1)", qty: "45,000 Pcs", date: "Mar 2026", progress: 15 },
    { title: "Celana Chino (Lebaran)", qty: "20,000 Pcs", date: "Apr 2026", progress: 5 },
    { title: "Jaket Denim (Winter Export)", qty: "12,000 Pcs", date: "May 2026", progress: 0 },
];

export default function PlanningPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 font-sans">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight">Perencanaan (MPS)</h2>
                    <p className="text-muted-foreground">Master Production Schedule & Capacity Planning.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="border-black font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all">
                        <Download className="mr-2 h-4 w-4" /> Export Excel
                    </Button>
                    <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide">
                        <CalendarIcon className="mr-2 h-4 w-4" /> New Schedule
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Schedule Column */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden">
                        <CardHeader className="bg-zinc-50 border-b border-black/10 pb-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="uppercase font-black text-lg flex items-center gap-2">
                                    <Layers className="h-5 w-5" /> Weekly Production Plan
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" className="h-8 w-8 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><ChevronLeft className="h-4 w-4" /></Button>
                                    <span className="font-bold text-sm bg-white border border-black px-3 py-1 rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">January 2026</span>
                                    <Button variant="outline" size="icon" className="h-8 w-8 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><ChevronRight className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {SCHEDULE.map((item, i) => (
                                <div key={i} className="flex flex-col sm:flex-row items-center justify-between p-4 border-b border-black/5 last:border-0 hover:bg-zinc-50 transition-colors group">
                                    <div className="flex items-center gap-4 w-full sm:w-auto mb-3 sm:mb-0">
                                        <div className="h-10 w-10 bg-black text-white rounded-lg flex items-center justify-center font-bold text-xs shadow-sm group-hover:scale-105 transition-transform">
                                            {item.week.split(' ')[0]}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">{item.week}</p>
                                            <p className="text-xs text-muted-foreground">Demand: <strong>{item.demand.toLocaleString()}</strong> pcs</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 w-full sm:w-auto">
                                        <div className="flex flex-col items-end min-w-[100px]">
                                            <span className="text-xs text-muted-foreground font-bold uppercase mb-1">Capacity: {item.capacity}%</span>
                                            <Progress value={item.capacity} className={`h-2 w-24 border border-black/10 ${item.capacity >= 100 ? 'bg-red-100' : 'bg-zinc-100'}`} indicatorClassName={item.capacity >= 100 ? 'bg-red-600' : 'bg-black'} />
                                        </div>
                                        <div className="flex flex-col items-end min-w-[80px]">
                                            <span className="text-xs font-bold mb-1">Plan:</span>
                                            <span className={`text-sm font-black ${item.production < item.demand ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {item.production.toLocaleString()}
                                            </span>
                                        </div>
                                        <Badge variant={item.status === 'Deficit' || item.status === 'Risk' ? 'destructive' : 'default'} className="uppercase border-black w-[80px] justify-center shadow-sm">
                                            {item.status}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Capacity Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="bg-amber-50 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <CardContent className="p-4 flex items-start gap-4">
                                <AlertCircle className="h-8 w-8 text-amber-600 shrink-0" />
                                <div>
                                    <h4 className="font-black text-amber-900 uppercase text-sm">Capacity Warning</h4>
                                    <p className="text-sm text-amber-800 mt-1">Week 4 is overloaded (105%). Need to schedule overtime or outsource 2,000 units.</p>
                                    <Button size="sm" className="mt-3 bg-amber-600 text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-amber-700 font-bold uppercase text-xs">Adjust Plan</Button>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-emerald-50 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <CardContent className="p-4 flex items-start gap-4">
                                <TrendingUp className="h-8 w-8 text-emerald-600 shrink-0" />
                                <div>
                                    <h4 className="font-black text-emerald-900 uppercase text-sm">Material Readiness</h4>
                                    <p className="text-sm text-emerald-800 mt-1">95% of raw materials for Jan production are in stock. Safe to proceed.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Forecast Side Panel */}
                <div className="space-y-6">
                    <Card className="h-full border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl">
                        <CardHeader className="bg-zinc-900 text-white rounded-t-lg pb-4 pt-5">
                            <CardTitle className="uppercase font-black text-lg flex items-center gap-2">
                                <CalendarDays className="h-5 w-5" /> Long Term Forecast
                            </CardTitle>
                            <CardDescription className="text-zinc-400">Projected demands Q1-Q2</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            {FORECAST.map((fc, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-sm uppercase">{fc.title}</h4>
                                            <p className="text-xs text-muted-foreground">Target: {fc.date}</p>
                                        </div>
                                        <Badge variant="outline" className="border-black font-bold">{fc.qty}</Badge>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
                                            <span>Preparation</span>
                                            <span>{fc.progress}%</span>
                                        </div>
                                        <Progress value={fc.progress} className="h-1.5 border border-black/10" />
                                    </div>
                                    {i < FORECAST.length - 1 && <Separator className="mt-4" />}
                                </div>
                            ))}

                            <Button className="w-full mt-4 bg-white text-black border-black border-2 hover:bg-zinc-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold uppercase">
                                View Full Forecast
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
