import { ArrowUpRight, ArrowDownRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface FinanceMetricCardProps {
    title: string
    value: string
    trend?: string
    trendUp?: boolean
    description?: string
    icon: any
    color?: "emerald" | "blue" | "rose" | "amber" | "indigo"
    className?: string
}

export function FinanceMetricCard({
    title,
    value,
    trend,
    trendUp,
    description,
    icon: Icon,
    color = "emerald",
    className
}: FinanceMetricCardProps) {
    const colorStyles = {
        emerald: "text-emerald-600 bg-white border-l-4 border-l-emerald-500 border border-zinc-200",
        blue: "text-zinc-700 bg-white border-l-4 border-l-zinc-400 border border-zinc-200",
        rose: "text-red-600 bg-white border-l-4 border-l-red-500 border border-zinc-200",
        amber: "text-amber-600 bg-white border-l-4 border-l-amber-500 border border-zinc-200",
        indigo: "text-zinc-700 bg-white border-l-4 border-l-orange-500 border border-zinc-200",
    }

    return (
        <div className={cn(
            "p-6 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-all duration-300",
            className
        )}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
                    <h3 className="text-3xl font-bold mt-2 font-serif text-foreground">{value}</h3>
                </div>
                <div className={cn("p-3 rounded-xl", colorStyles[color])}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>

            {(trend || description) && (
                <div className="mt-4 flex items-center gap-2 text-sm">
                    {trend && (
                        <span className={cn(
                            "flex items-center font-medium px-2 py-0.5 rounded-full text-xs",
                            trendUp
                                ? "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-400"
                                : "text-rose-600 bg-rose-100 dark:bg-rose-900/50 dark:text-rose-400"
                        )}>
                            {trendUp ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                            {trend}
                        </span>
                    )}
                    {description && (
                        <span className="text-muted-foreground">{description}</span>
                    )}
                </div>
            )}
        </div>
    )
}
