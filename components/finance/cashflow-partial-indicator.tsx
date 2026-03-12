"use client"

import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"

interface PartialIndicatorProps {
    paidAmount: number
    totalAmount: number
    percentage: number
}

export function CashflowPartialIndicator({ paidAmount, totalAmount, percentage }: PartialIndicatorProps) {
    return (
        <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-xs">
                <span className="font-medium">{formatCurrency(paidAmount)}</span>
                <span className="text-zinc-400">/</span>
                <span className="text-zinc-500">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-16 rounded-full bg-zinc-200 overflow-hidden">
                    <div
                        className={cn(
                            "h-full rounded-full transition-all",
                            percentage >= 100 ? "bg-emerald-500" : percentage >= 50 ? "bg-amber-500" : "bg-red-400"
                        )}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                </div>
                <span className={cn(
                    "text-[10px] font-medium",
                    percentage >= 100 ? "text-emerald-600" : "text-amber-600"
                )}>
                    {percentage}%
                </span>
            </div>
        </div>
    )
}
