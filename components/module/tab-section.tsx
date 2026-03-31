"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface Tab {
  label: string
  value: string
  count?: number
  icon?: React.ReactNode
}

interface TabSectionProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (value: string) => void
  children: React.ReactNode
  className?: string
}

export function TabSection({
  tabs,
  activeTab,
  onTabChange,
  children,
  className,
}: TabSectionProps) {
  return (
    <div className={cn("", className)}>
      {/* Tab header */}
      <div className="flex bg-black">
        {tabs.map((tab) => {
          const isActive = tab.value === activeTab
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onTabChange(tab.value)}
              className={cn(
                "px-6 py-3 uppercase text-sm font-bold tracking-wider transition-colors flex items-center gap-2",
                isActive
                  ? "bg-black text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count != null && (
                <span
                  className={cn(
                    "ml-1 min-w-[20px] h-5 rounded-full inline-flex items-center justify-center text-xs font-bold px-1.5",
                    isActive
                      ? "bg-white text-black"
                      : "bg-gray-600 text-gray-300"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content area */}
      <div className="border-2 border-black border-t-0 min-h-[200px] bg-white">
        {children}
      </div>
    </div>
  )
}
