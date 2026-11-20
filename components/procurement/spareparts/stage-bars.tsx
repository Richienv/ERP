"use client"

import { cn } from "@/lib/utils"
import { GOODS_STAGE_LABEL, PAY_STAGE_LABEL, type GoodsStage, type PayStage } from "@/lib/sparepart-purchase-logic"

const PAY_TONE: Record<PayStage, string> = {
    NO_BILL: "bg-slate-300",
    UNPOSTED: "bg-zinc-300",
    UNPAID: "bg-amber-500",
    PARTIAL: "bg-amber-500",
    PAID: "bg-emerald-500",
    VOID: "bg-zinc-300",
}
const GOODS_TONE: Record<GoodsStage, string> = {
    ORDERED: "bg-zinc-400",
    SHIPPED: "bg-sky-500",
    PARTIAL: "bg-sky-500",
    RECEIVED: "bg-emerald-500",
    CANCELLED: "bg-zinc-300",
}

/** One thin labelled progress bar. The fill animates with a transform, so it never re-lays out. */
export function StageBar({ label, pct, tone, overdue, className }: { label: string; pct: number; tone: string; overdue?: boolean; className?: string }) {
    return (
        <div className={cn("min-w-[118px]", className)}>
            <div className="flex items-center justify-between gap-2">
                <span className={cn("text-xs font-bold", overdue ? "text-red-600" : "text-zinc-700 dark:text-zinc-300")}>{label}</span>
                <span className="text-xs font-mono font-bold text-zinc-400 tabular-nums">{Math.round(pct * 100)}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                    className={cn("h-full origin-left transition-transform duration-500 ease-out", overdue ? "bg-red-500" : tone)}
                    style={{ transform: `scaleX(${Math.max(0.02, pct)})` }}
                />
            </div>
        </div>
    )
}

export function PayBar({ stage, pct, overdue }: { stage: PayStage; pct: number; overdue?: boolean }) {
    const label = overdue ? "Lewat jatuh tempo" : PAY_STAGE_LABEL[stage]
    return <StageBar label={label} pct={stage === "PAID" ? 1 : pct} tone={PAY_TONE[stage]} overdue={overdue} />
}

export function GoodsBar({ stage, pct }: { stage: GoodsStage; pct: number }) {
    return <StageBar label={GOODS_STAGE_LABEL[stage]} pct={stage === "RECEIVED" ? 1 : stage === "SHIPPED" ? Math.max(pct, 0.08) : pct} tone={GOODS_TONE[stage]} />
}
