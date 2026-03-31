"use client"

import * as React from "react"
import { NB } from "@/lib/dialog-styles"

export interface StatusTab {
  label: string
  value: string
  count: number
  color?: "orange" | "gray" | "blue" | "red" | "green"
}

export interface StatusTabBarProps {
  tabs: StatusTab[]
  activeTab: string
  onTabChange: (value: string) => void
  /** Right-side summary text, e.g. "4 INVOICE" */
  totalLabel?: string
}

const dotColorMap: Record<string, string> = {
  orange: "bg-orange-500",
  gray: "bg-zinc-400",
  blue: "bg-blue-500",
  red: "bg-red-500",
  green: "bg-emerald-500",
}

const countColorMap: Record<string, string> = {
  orange: "text-zinc-900 dark:text-white",
  gray: "text-zinc-900 dark:text-white",
  blue: "text-zinc-900 dark:text-white",
  red: "text-red-600 dark:text-red-400",
  green: "text-zinc-900 dark:text-white",
}

export function StatusTabBar({ tabs, activeTab, onTabChange, totalLabel }: StatusTabBarProps) {
  return (
    <div className={`${NB.pageRowBorder} overflow-x-auto`}>
      <div className={NB.kpiStrip}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.value
          const dotColor = dotColorMap[tab.color ?? "gray"] ?? "bg-zinc-400"
          const numColor = tab.color === "red" && tab.count > 0
            ? "text-red-600 dark:text-red-400"
            : (countColorMap[tab.color ?? "gray"] ?? "text-zinc-900 dark:text-white")

          return (
            <button
              key={tab.value}
              onClick={() => onTabChange(tab.value)}
              className={`${NB.kpiCell} transition-colors ${
                isActive
                  ? "bg-orange-50/60 dark:bg-orange-950/20"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
              }`}
            >
              {/* Left: dot + label */}
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 shrink-0 ${dotColor}`} />
                <span className={`text-[11px] font-bold uppercase tracking-wider ${
                  isActive ? "text-orange-600 dark:text-orange-400" : "text-zinc-500 dark:text-zinc-400"
                }`}>
                  {tab.label}
                </span>
              </div>
              {/* Right: count */}
              <span className={`text-xl font-black ${numColor}`}>{tab.count}</span>
            </button>
          )
        })}

        {/* Optional total label at the end */}
        {totalLabel && (
          <div className="px-4 py-3 flex items-center shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              {totalLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
