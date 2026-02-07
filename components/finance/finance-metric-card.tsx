import { ArrowUpRight, ArrowDownRight, DollarSign, Wallet, CreditCard, Activity } from "lucide-react"
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
        emerald: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900",
        blue: "text-blue-500 bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900",
        rose: "text-rose-500 bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900",
        amber: "text-amber-500 bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900",
        indigo: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900",
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
