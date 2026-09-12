"use client"

import { cn } from "@/lib/utils"
import { AlertTriangle, Info, Check, X } from "lucide-react"

export interface ApprovalItem {
  id: string
  documentNumber: string
  status: string
  counterpartyName: string
  date?: string
  amount: number
}

export interface ApprovalBannerProps {
  title: string
  items: ApprovalItem[]
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  onViewDetail?: (id: string) => void
  variant?: "warning" | "info"
  totalAmount?: number
  formatAmount?: (n: number) => string
  className?: string
}

const variants = {
  warning: {
    border: "border-2 border-amber-300 dark:border-amber-700",
    bg: "bg-amber-50/50 dark:bg-amber-950/20",
    shadow: "shadow-[3px_3px_0px_0px_rgba(217,119,6,0.3)]",
    headerBg: "border-b border-amber-200 dark:border-amber-800",
    headerText: "text-amber-700 dark:text-amber-400",
    amountText: "text-amber-700 dark:text-amber-400",
    divider: "divide-amber-100 dark:divide-amber-900/50",
    badge: "bg-amber-200/60 text-amber-700 border border-amber-300",
    icon: AlertTriangle,
  },
  info: {
    border: "border-2 border-zinc-300 dark:border-zinc-700",
    bg: "bg-zinc-50/50 dark:bg-zinc-900/20",
    shadow: "shadow-[3px_3px_0px_0px_rgba(0,0,0,0.12)]",
    headerBg: "border-b border-zinc-200 dark:border-zinc-800",
    headerText: "text-zinc-700 dark:text-zinc-300",
    amountText: "text-zinc-700 dark:text-zinc-300",
    divider: "divide-zinc-100 dark:divide-zinc-800",
    badge: "bg-zinc-200/60 text-zinc-700 border border-zinc-300",
    icon: Info,
  },
}

function defaultFormat(n: number): string {
  return "Rp " + n.toLocaleString("id-ID")
}

export function ApprovalBanner({
  title,
  items,
  onApprove,
  onReject,
  onViewDetail,
  variant = "warning",
  totalAmount,
  formatAmount = defaultFormat,
  className,
}: ApprovalBannerProps) {
  if (items.length === 0) return null

  const v = variants[variant]
  const Icon = v.icon

  return (
    <div className={cn(v.border, v.bg, v.shadow, className)}>
      {/* Header */}
      <div
        className={cn(
          "px-4 py-2.5 flex items-center justify-between",
          v.headerBg,
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", v.headerText)} />
          <span
            className={cn(
              "text-xs font-black uppercase tracking-wider",
              v.headerText,
            )}
          >
            {title} ({items.length})
          </span>
        </div>
        {totalAmount != null && (
          <span
            className={cn("text-xs font-bold font-mono", v.amountText)}
          >
            {formatAmount(totalAmount)}
          </span>
        )}
      </div>

      {/* Item rows */}
      <div className={cn("divide-y", v.divider)}>
        {items.map((item) => (
          <div
            key={item.id}
            className="px-4 py-2 flex items-center gap-3 text-sm flex-wrap sm:flex-nowrap"
          >
            {/* Document number — clickable if handler provided */}
            <button
              type="button"
              onClick={() => onViewDetail?.(item.id)}
              disabled={!onViewDetail}
              className={cn(
                "font-bold text-xs font-mono shrink-0",
                onViewDetail
                  ? "text-zinc-800 dark:text-zinc-200 hover:underline cursor-pointer"
                  : "text-zinc-800 dark:text-zinc-200 cursor-default",
              )}
            >
              {item.documentNumber}
            </button>

            {/* Status badge */}
            <span
              className={cn(
                "text-xs uppercase px-1.5 py-0.5 font-bold shrink-0",
                v.badge,
              )}
            >
              {item.status}
            </span>

            {/* Counterparty */}
            <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate flex-1 min-w-0">
              {item.counterpartyName || "-"}
            </span>

            {/* Date */}
            {item.date && (
              <span className="text-xs text-zinc-500 dark:text-zinc-500 shrink-0 font-mono">
                {item.date}
              </span>
            )}

            {/* Amount */}
            <span className="text-xs font-bold font-mono text-zinc-800 dark:text-zinc-200 shrink-0 min-w-[100px] text-right">
              {formatAmount(item.amount)}
            </span>

            {/* Action buttons */}
            {(onApprove || onReject) && (
              <div className="flex items-center gap-1 shrink-0 ml-1">
                {onApprove && (
                  <button
                    type="button"
                    onClick={() => onApprove(item.id)}
                    className="bg-emerald-600 text-white rounded-none h-7 text-xs font-black uppercase px-2.5 border-2 border-emerald-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] hover:bg-emerald-700 hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.2)] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-1"
                  >
                    <Check className="h-3 w-3" /> Setujui
                  </button>
                )}
                {onReject && (
                  <button
                    type="button"
                    onClick={() => onReject(item.id)}
                    className="text-red-700 border-2 border-red-700 rounded-none h-7 text-xs font-black uppercase px-2.5 bg-white dark:bg-transparent shadow-[2px_2px_0px_0px_rgba(198,40,40,0.2)] hover:bg-red-50 dark:hover:bg-red-950/20 hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(198,40,40,0.2)] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Tolak
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
