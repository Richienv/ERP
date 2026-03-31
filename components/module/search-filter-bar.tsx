"use client"

import { cn } from "@/lib/utils"
import { NB } from "@/lib/dialog-styles"
import { Search, X, Filter, RotateCcw } from "lucide-react"

export interface FilterDropdown {
  label: string
  value: string
  options: { label: string; value: string }[]
  onChange: (value: string) => void
}

export interface SearchFilterBarProps {
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  onSearch?: () => void
  filters?: FilterDropdown[]
  filterButtonLabel?: string
  onApplyFilters?: () => void
  onResetFilters?: () => void
  actions?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
    variant?: "primary" | "outline" | "ghost"
  }[]
  resultCount?: string
  className?: string
}

export function SearchFilterBar({
  searchPlaceholder = "Cari...",
  searchValue = "",
  onSearchChange,
  onSearch,
  filters,
  filterButtonLabel = "TERAPKAN",
  onApplyFilters,
  onResetFilters,
  actions,
  resultCount,
  className,
}: SearchFilterBarProps) {
  const hasSearch = !!searchValue
  const hasFilters = filters?.some((f) => f.value !== "") ?? false
  const hasActiveFilters = hasSearch || hasFilters

  return (
    <div className={cn(NB.filterBar, className)}>
      {/* Left: Search + Filters + Apply */}
      <div className="flex items-center gap-0 flex-wrap sm:flex-nowrap">
        {/* Search input */}
        {onSearchChange && (
          <div className="relative">
            <Search
              className={cn(
                "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 z-10 transition-colors",
                hasSearch ? NB.inputIconActive : NB.inputIconEmpty,
              )}
            />
            <input
              type="text"
              className={cn(
                "border font-medium h-9 w-[280px] text-xs rounded-none pl-9 pr-8 outline-none placeholder:text-zinc-400 transition-all",
                filters && filters.length > 0 ? "border-r-0" : "",
                hasSearch ? NB.inputActive : NB.inputEmpty,
              )}
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSearch?.() ?? onApplyFilters?.()
                }
              }}
            />
            {hasSearch && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors z-10"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Filter dropdowns */}
        {filters?.map((filter, idx) => {
          const isLast = idx === filters.length - 1 && !onApplyFilters
          const hasValue = filter.value !== ""
          return (
            <div key={filter.label} className="relative">
              <select
                value={filter.value}
                onChange={(e) => filter.onChange(e.target.value)}
                className={cn(
                  "appearance-none h-9 px-3 text-xs font-medium min-w-[120px] rounded-none border outline-none transition-all cursor-pointer",
                  !isLast && "border-r-0",
                  hasValue
                    ? "border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 text-zinc-900 dark:text-white"
                    : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800",
                )}
              >
                <option value="">{filter.label}</option>
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )
        })}

        {/* Apply button */}
        {onApplyFilters && (
          <button
            type="button"
            onClick={onApplyFilters}
            className={cn(
              NB.toolbarBtn,
              "flex items-center gap-1.5",
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            {filterButtonLabel}
          </button>
        )}

        {/* Reset button */}
        {hasActiveFilters && onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="text-zinc-400 text-[10px] font-bold uppercase h-9 px-3 rounded-none hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors ml-1.5 flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      {/* Right: Actions + Result count */}
      <div className="flex items-center gap-2">
        {actions?.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={cn(
              action.variant === "primary"
                ? NB.toolbarBtnPrimary
                : action.variant === "ghost"
                  ? "text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-wider h-9 px-3 rounded-none hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                  : NB.toolbarBtn,
              "flex items-center gap-1.5",
            )}
          >
            {action.icon}
            {action.label}
          </button>
        ))}

        {resultCount && (
          <span className="hidden md:inline text-[11px] font-medium text-zinc-400 ml-1">
            <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">
              {resultCount}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}
