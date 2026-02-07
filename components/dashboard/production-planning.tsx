"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Factory, Cog, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface ProductionBatch {
    id: string;
    product: string;
    machine: string;
    startDate: string;
    status: "Persiapan" | "Penenunan" | "Pewarnaan" | "QC" | "Penyelesaian";
    quality: number;
    progress: number; // 0-100
}

const batches: ProductionBatch[] = [
    { id: "PO-8932", product: "Cotton Combed 30s - Navy", machine: "Mesin #04", startDate: "24 Okt", status: "Pewarnaan", quality: 98, progress: 65 },
    { id: "PO-8933", product: "Polyester Blend - Grey", machine: "Mesin #02", startDate: "25 Okt", status: "Penenunan", quality: 95, progress: 35 },
    { id: "PO-8934", product: "Rayon Viscose - Black", machine: "Mesin #08", startDate: "26 Okt", status: "QC", quality: 100, progress: 85 },
    { id: "PO-8935", product: "Spandex Fiber - White", machine: "Mesin #01", startDate: "26 Okt", status: "Persiapan", quality: 100, progress: 10 },
];

const stages = ["Persiapan", "Penenunan", "Pewarnaan", "QC", "Penyelesaian"];

export function ProductionPlanning() {
    return (
        <div className="relative bg-card border border-border/50 rounded-3xl min-h-[400px] flex flex-col overflow-hidden group hover:shadow-lg transition-all duration-300">
            {/* Subtle Spotlight */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-primary/5 blur-[60px] opacity-20 pointer-events-none" />

            {/* Grain Overlay */}
            <div
                className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}
            />

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between p-6 border-b border-border/50">
                <div>
                    <h3 className="font-medium text-lg text-foreground">Perencanaan Produksi</h3>
                    <p className="text-xs text-muted-foreground mt-1">Linimasa Produksi & Manajemen Kualitas (BOM)</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center border border-border/50">
                    <Factory className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                </div>
            </div>

            {/* Content Table/List */}
            <div className="flex-1 p-6 space-y-6 overflow-x-auto">
                {batches.map((batch, index) => (
                    <div key={batch.id} className="group/item relative flex flex-col md:flex-row md:items-center gap-6 p-4 rounded-2xl bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors">

                        {/* Info Column */}
                        <div className="w-full md:w-1/4 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">{batch.id}</span>
                                <span className="text-xs text-muted-foreground md:hidden">{batch.startDate}</span>
                            </div>
                            <h4 className="font-medium text-foreground truncate" title={batch.product}>{batch.product}</h4>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Cog className="h-3 w-3" />
                                {batch.machine}
                            </div>
                        </div>

                        {/* Timeline Column */}
                        <div className="flex-1 relative pt-2">
                            {/* Progress Line */}
                            <div className="absolute top-1/2 left-0 w-full h-1 bg-border rounded-full -translate-y-1/2" />
                            <motion.div
                                className="absolute top-1/2 left-0 h-1 bg-indigo-500 rounded-full -translate-y-1/2"
                                initial={{ width: 0 }}
                                animate={{ width: `${batch.progress}%` }}
                                transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                            />

                            {/* Stages Steps */}
                            <div className="relative flex justify-between z-10 w-full">
                                {stages.map((stage, i) => {
                                    const isCompleted = stages.indexOf(batch.status) > i;
                                    const isCurrent = batch.status === stage;

                                    return (
                                        <div key={stage} className="flex flex-col items-center gap-2 group/step">
                                            <div className={cn(
                                                "h-3 w-3 rounded-full border-2 transition-all duration-300",
                                                isCompleted ? "bg-indigo-500 border-indigo-500" :
                                                    isCurrent ? "bg-white dark:bg-zinc-950 border-indigo-500 scale-125 shadow-[0_0_10px_rgba(99,102,241,0.5)]" :
                                                        "bg-secondary border-border"
                                            )} />
                                            <span className={cn(
                                                "text-[10px] font-medium transition-colors hidden sm:block",
                                                isCurrent ? "text-indigo-500" : "text-muted-foreground"
                                            )}>{stage}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Quality & Status Column */}
                        <div className="w-full md:w-1/6 flex md:flex-col items-center md:items-end justify-between gap-2 pl-4 md:border-l border-border/50">
                            <Badge variant={batch.quality >= 95 ? "default" : "destructive"} className={cn(
                                "rounded-full shadow-none font-normal",
                                batch.quality >= 95 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20" : "bg-rose-500/10 text-rose-600 hover:bg-rose-500/20"
                            )}>
                                Skor Kualitas: {batch.quality}%
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                {batch.status === 'QC' ? <AlertCircle className="h-3 w-3 text-orange-500" /> : <Clock className="h-3 w-3" />}
                                {batch.status}
                            </span>
                        </div>

                    </div>
                ))}
            </div>

            <div className="p-6 border-t border-border/50 bg-secondary/30 rounded-b-3xl flex justify-between items-center text-xs text-muted-foreground">
                <p>Menampilkan 4 batch produksi aktif</p>
                <div className="flex gap-4">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Selesai</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-border border-2 border-indigo-500"></div> Saat Ini</span>
                </div>
            </div>
        </div>
    );
}
