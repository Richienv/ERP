"use client";

import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface MetricCardProps {
    title: string;
    value: string;
    trend: string;
    trendUp?: boolean;
    className?: string;
}

export function MetricCardMini({ title, value, trend, trendUp = true, className }: MetricCardProps) {
    return (
        <div className={cn(
            "bg-card/90 dark:bg-card/70 backdrop-blur-xl border border-border/50",
            "rounded-3xl p-6 flex flex-col justify-between group",
            "hover:border-border transition-all duration-300 hover:shadow-lg shadow-sm",
            className
        )}>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{title}</p>

            <div className="space-y-1 mt-4">
                <h3 className="text-3xl font-medium font-serif text-foreground tracking-tight group-hover:scale-105 transition-transform origin-left">{value}</h3>
                <div className={cn("flex items-center gap-1 text-xs font-medium", trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                    {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {trend}
                    <span className="text-muted-foreground ml-1 font-sans">vs last month</span>
                </div>
            </div>
        </div>
    );
}
