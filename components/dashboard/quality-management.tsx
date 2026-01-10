"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, ShieldCheck, AlertTriangle, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const inspections = [
    { id: "QC-2024-001", item: "Cotton Combed 30s Batch #9", status: "Lolos", date: "2 jam y.l.", inspector: "Budi S." },
    { id: "QC-2024-002", item: "Hasil Pewarnaan - Navy", status: "Gagal", date: "4 jam y.l.", inspector: "Siti A." },
    { id: "QC-2024-003", item: "Cek Cacat Tenun", status: "Lolos", date: "5 jam y.l.", inspector: "Joko W." },
    { id: "QC-2024-004", item: "Inspeksi Akhir - Kaos Polo", status: "Lolos", date: "Kemarin", inspector: "Budi S." },
];

export function QualityManagement() {
    return (
        <div className="relative bg-card border border-border/50 rounded-3xl min-h-[400px] flex flex-col overflow-hidden group hover:shadow-lg transition-all duration-300">
            {/* Subtle Spotlight */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-primary/5 blur-[60px] opacity-20 pointer-events-none" />

            {/* Grain Overlay */}
            <div
                className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}
            />

            <div className="relative z-10 flex items-center justify-between p-6 border-b border-border/50">
                <div>
                    <h3 className="font-medium text-lg text-foreground">Manajemen Kualitas</h3>
                    <p className="text-xs text-muted-foreground mt-1">QC, Inspeksi & Kepatuhan</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center border border-border/50">
                    <ShieldCheck className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                </div>
            </div>

            <div className="p-6 space-y-6 flex-1 flex flex-col">
                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-secondary/30 border border-border/50 flex flex-col justify-center items-center text-center">
                        <span className="text-2xl font-serif font-medium text-emerald-600 dark:text-emerald-400">98.5%</span>
                        <span className="text-xs text-muted-foreground">Tingkat Lolos</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-secondary/30 border border-border/50 flex flex-col justify-center items-center text-center">
                        <span className="text-2xl font-serif font-medium text-rose-600 dark:text-rose-400">1.2%</span>
                        <span className="text-xs text-muted-foreground">Tingkat Cacat</span>
                    </div>
                </div>

                {/* Compliance Badges */}
                <div className="flex gap-2 justify-center">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1">
                        <FileCheck className="h-3 w-3" /> ISO 9001
                    </Badge>
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1">
                        <FileCheck className="h-3 w-3" /> OEKO-TEX
                    </Badge>
                </div>

                {/* Recent Inspections List */}
                <div className="space-y-3 flex-1">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Inspeksi Terakhir</h4>
                    <div className="space-y-2">
                        {inspections.map((insp) => (
                            <div key={insp.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/20 hover:bg-secondary/40 transition-colors border border-border/50">
                                <div className="flex items-center gap-3">
                                    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center border",
                                        insp.status === 'Lolos' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-rose-500/10 border-rose-500/20 text-rose-500"
                                    )}>
                                        {insp.status === 'Lolos' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground truncate max-w-[120px]">{insp.item}</p>
                                        <p className="text-[10px] text-muted-foreground">{insp.date} • {insp.inspector}</p>
                                    </div>
                                </div>
                                <Badge variant={insp.status === 'Lolos' ? 'secondary' : 'destructive'} className="text-[10px] h-5">
                                    {insp.status}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
