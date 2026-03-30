"use client"

import * as React from "react"
import { NB } from "@/lib/dialog-styles"
import { formatIDR } from "@/lib/utils"

export interface AgingBucket {
  label: string
  amount: number
  /** Tailwind text color class, e.g. "text-emerald-600" */
  color?: string
}

export interface AgingBarProps {
  buckets: AgingBucket[]
  className?: string
  /** Custom formatter — defaults to formatIDR */
  formatAmount?: (amount: number) => string
}

export function AgingBar({ buckets, className, formatAmount }: AgingBarProps) {
  const fmt = formatAmount ?? formatIDR

  return (
    <div className={`${NB.pageRowBorder} overflow-x-auto ${className ?? ""}`}>
      <div className={NB.kpiStrip}>
        {buckets.map((bucket) => (
          <div key={bucket.label} className={NB.kpiCell}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {bucket.label}
            </span>
            <span className={`text-sm font-black font-mono ${bucket.color ?? "text-zinc-900 dark:text-white"}`}>
              {fmt(bucket.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
