"use client"

import { cn } from "@/lib/utils"

export interface SummaryCard {
  label: string
  value: string | number
  subValue?: string
  color?: "default" | "green" | "orange" | "red" | "blue"
  icon?: React.ReactNode
}

export interface SummaryCardsProps {
  cards: SummaryCard[]
  columns?: 2 | 3 | 4
  className?: string
}

const dotColor: Record<NonNullable<SummaryCard["color"]>, string> = {
  default: "bg-zinc-400",
  green: "bg-emerald-500",
  orange: "bg-amber-500",
  red: "bg-red-500",
  blue: "bg-blue-500",
}

const bgTint: Record<NonNullable<SummaryCard["color"]>, string> = {
  default: "",
  green: "bg-emerald-50/50 dark:bg-emerald-950/10",
  orange: "bg-amber-50/50 dark:bg-amber-950/10",
  red: "bg-red-50/50 dark:bg-red-950/10",
  blue: "bg-blue-50/50 dark:bg-blue-950/10",
}

const labelColor: Record<NonNullable<SummaryCard["color"]>, string> = {
  default: "text-zinc-500 dark:text-zinc-400",
  green: "text-emerald-600 dark:text-emerald-400",
  orange: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
  blue: "text-blue-600 dark:text-blue-400",
}

const valueColor: Record<NonNullable<SummaryCard["color"]>, string> = {
  default: "text-zinc-900 dark:text-white",
  green: "text-emerald-700 dark:text-emerald-300",
  orange: "text-amber-700 dark:text-amber-300",
  red: "text-red-700 dark:text-red-300",
  blue: "text-blue-700 dark:text-blue-300",
}

const subColor: Record<NonNullable<SummaryCard["color"]>, string> = {
  default: "text-zinc-500 dark:text-zinc-400",
  green: "text-emerald-500 dark:text-emerald-400",
  orange: "text-amber-500 dark:text-amber-400",
  red: "text-red-500 dark:text-red-400",
  blue: "text-blue-500 dark:text-blue-400",
}

const colsClass: Record<2 | 3 | 4, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
}

export function SummaryCards({ cards, columns = 3, className }: SummaryCardsProps) {
  return (
    <div
      className={cn(
        "grid border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden",
        colsClass[columns],
        className,
      )}
    >
      {cards.map((card, i) => {
        const c = card.color ?? "default"
        return (
          <div
            key={card.label + i}
            className={cn(
              "px-5 py-4",
              bgTint[c],
              // Right border between cards (not on last per row — handled by grid gap-0)
              i < cards.length - 1 &&
                "border-b sm:border-b-0 sm:border-r-2 border-black",
              // On mobile stacked, add bottom border except last
              i === cards.length - 1 && "border-b-0",
            )}
          >
            {/* Label row */}
            <div className="flex items-center gap-1.5 mb-1">
              {card.icon ?? (
                <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor[c])} />
              )}
              <span
                className={cn(
                  "text-[10px] font-black uppercase tracking-widest",
                  labelColor[c],
                )}
              >
                {card.label}
              </span>
            </div>

            {/* Value */}
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-3xl font-black tabular-nums",
                  valueColor[c],
                )}
              >
                {card.value}
              </span>
              {card.subValue && (
                <span
                  className={cn(
                    "text-sm font-mono font-bold",
                    subColor[c],
                  )}
                >
                  {card.subValue}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
