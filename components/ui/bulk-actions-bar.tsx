"use client"

import { IconX } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface BulkAction {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: "default" | "destructive"
}

interface BulkActionsBarProps {
  selectedCount: number
  onClearSelection: () => void
  actions: BulkAction[]
  className?: string
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  actions,
  className,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-3 px-4 py-2.5",
        "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900",
        "border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
        "animate-in slide-in-from-bottom-4 fade-in duration-200",
        className
      )}
    >
      <span className="text-sm font-semibold tabular-nums">
        {selectedCount} dipilih
      </span>

      <div className="w-px h-5 bg-zinc-600 dark:bg-zinc-400" />

      {actions.map((action) => (
        <Button
          key={action.label}
          size="sm"
          variant="ghost"
          onClick={action.onClick}
          className={cn(
            "h-8 px-3 text-xs font-medium rounded-none",
            action.variant === "destructive"
              ? "text-red-400 hover:text-red-300 hover:bg-red-950 dark:text-red-600 dark:hover:text-red-700 dark:hover:bg-red-50"
              : "text-zinc-300 hover:text-white hover:bg-zinc-800 dark:text-zinc-600 dark:hover:text-zinc-900 dark:hover:bg-zinc-200"
          )}
        >
          {action.icon}
          {action.label}
        </Button>
      ))}

      <div className="w-px h-5 bg-zinc-600 dark:bg-zinc-400" />

      <button
        type="button"
        onClick={onClearSelection}
        className="p-1 text-zinc-400 hover:text-white dark:text-zinc-500 dark:hover:text-zinc-900 transition-colors"
        aria-label="Hapus seleksi"
      >
        <IconX className="w-4 h-4" />
      </button>
    </div>
  )
}
