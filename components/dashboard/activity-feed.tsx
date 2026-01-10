"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    CreditCard,
    Package,
    UserPlus,
    AlertCircle,
    FileText,
    CheckCircle2,
    Clock
} from "lucide-react";

const activities = [
    {
        id: 1,
        type: "order",
        title: "Pesanan Produksi Baru #PO-8932",
        description: "Pesanan masuk untuk 500 lusin Kaos Polos dari PT. Mitra Abadi.",
        time: "10 menit yang lalu",
        icon: FileText,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        border: "border-blue-500/20"
    },
    {
        id: 2,
        type: "alert",
        title: "Stok Benang Polyester Rendah",
        description: "Stok di Gudang A tersisa kurang dari 150 kg.",
        time: "45 menit yang lalu",
        icon: AlertCircle,
        color: "text-amber-500",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20"
    },
    {
        id: 3,
        type: "success",
        title: "QC Lolos - Batch #B-992",
        description: "Hasil pewarnaan batch Cotton Combed 24s telah disetujui.",
        time: "2 jam yang lalu",
        icon: CheckCircle2,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20"
    },
    {
        id: 4,
        type: "user",
        title: "Karyawan Baru Terdaftar",
        description: "3 operator jahit baru telah ditambahkan ke sistem HR.",
        time: "5 jam yang lalu",
        icon: UserPlus,
        color: "text-purple-500",
        bg: "bg-purple-500/10",
        border: "border-purple-500/20"
    },
];

export function ActivityFeed() {
    return (
        <div className={cn(
            "relative bg-card border border-border/50 rounded-3xl overflow-hidden min-h-[400px] flex flex-col",
            "group hover:shadow-lg transition-all duration-300"
        )}>
            {/* Subtle Spotlight */}
            <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-primary/5 blur-[60px] opacity-20 pointer-events-none" />

            {/* Grain Overlay */}
            <div
                className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}
            />

            <div className="relative z-10 flex items-center justify-between p-6 border-b border-border/50">
                <div>
                    <h3 className="font-medium text-lg text-foreground">Aktivitas Terbaru</h3>
                    <p className="text-xs text-muted-foreground mt-1">Update sistem real-time</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center border border-border/50">
                    <Clock className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                </div>
            </div>

            <div className="flex-1 p-6 space-y-6">
                {activities.map((activity, index) => (
                    <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="group/item flex gap-4"
                    >
                        <div className={cn(
                            "relative flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center border transition-colors duration-300",
                            activity.bg,
                            activity.color,
                            activity.border,
                            "group-hover/item:scale-110"
                        )}>
                            <activity.icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-foreground group-hover/item:text-primary transition-colors">
                                    {activity.title}
                                </p>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                    {activity.time}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                                {activity.description}
                            </p>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="relative z-10 p-4 border-t border-border/50 bg-secondary/30 text-center">
                <button className="text-xs font-medium text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors">
                    Lihat Semua Aktivitas
                </button>
            </div>
        </div>
    );
}
