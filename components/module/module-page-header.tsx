"use client"

import * as React from "react"
import { NB } from "@/lib/dialog-styles"
import { Button } from "@/components/ui/button"

interface PrimaryAction {
  label: string
  onClick: () => void
  icon?: React.ReactNode
}

interface SecondaryAction {
  label: string
  onClick: () => void
  icon?: React.ReactNode
  variant?: "outline" | "ghost"
}

interface Tab {
  label: string
  value: string
}

export interface ModulePageHeaderProps {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  primaryAction?: PrimaryAction
  secondaryActions?: SecondaryAction[]
  tabs?: Tab[]
  onTabChange?: (value: string) => void
  activeTab?: string
  /** Extra content rendered below the title row (e.g. KPI strip, filter bar) */
  children?: React.ReactNode
}

export function ModulePageHeader({
  icon,
  title,
  subtitle,
  primaryAction,
  secondaryActions,
  tabs,
  onTabChange,
  activeTab,
  children,
}: ModulePageHeaderProps) {
  return (
    <div className={NB.pageCard}>
      {/* Orange accent bar */}
      <div className={NB.pageAccent} />

      {/* Row 1: Title + Actions/Tabs */}
      <div className={`px-5 py-3.5 flex items-center justify-between ${children ? NB.pageRowBorder : ""}`}>
        {/* Left: icon + title */}
        <div className="flex items-center gap-3">
          {icon && (
            <div className="w-9 h-9 bg-orange-500 flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="text-zinc-400 text-[11px] font-medium">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: tabs OR action buttons */}
        {tabs && tabs.length > 0 ? (
          <div className="flex items-center gap-0">
            {tabs.map((tab, idx) => (
              <button
                key={tab.value}
                onClick={() => onTabChange?.(tab.value)}
                className={`h-9 px-4 text-[10px] font-black uppercase tracking-widest transition-all border rounded-none ${
                  idx < tabs.length - 1 ? "border-r-0" : ""
                } ${
                  activeTab === tab.value
                    ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                    : "bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-0 flex-wrap">
            {secondaryActions?.map((action, idx) => (
              <Button
                key={action.label}
                onClick={action.onClick}
                variant="outline"
                className={`${NB.toolbarBtn} ${
                  idx < (secondaryActions?.length ?? 0) - 1 ? NB.toolbarBtnJoin : ""
                }`}
              >
                {action.icon && <span className="mr-1.5">{action.icon}</span>}
                {action.label}
              </Button>
            ))}
            {primaryAction && (
              <Button
                onClick={primaryAction.onClick}
                className={NB.toolbarBtnPrimary}
              >
                {primaryAction.icon && <span className="mr-1.5">{primaryAction.icon}</span>}
                {primaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Children: KPI strip, filter bar, etc. */}
      {children}
    </div>
  )
}
