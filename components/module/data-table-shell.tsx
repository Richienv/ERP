"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { IconDatabaseOff } from "@tabler/icons-react"

interface DataTableShellProps {
  title?: string
  titleCount?: number
  children: React.ReactNode
  footer?: React.ReactNode
  emptyState?: {
    icon?: React.ReactNode
    message: string
  }
  isEmpty?: boolean
  className?: string
}

export function DataTableShell({
  title,
  titleCount,
  children,
  footer,
  emptyState,
  isEmpty,
  className,
}: DataTableShellProps) {
  return (
    <div className={cn("border border-border bg-white overflow-hidden", className)}>
      {title && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
          <span className="text-sm font-bold  ">{title}</span>
          {titleCount != null && (
            <span className="min-w-[24px] h-5 rounded-full bg-gray-200 text-xs font-bold inline-flex items-center justify-center px-1.5">
              {titleCount}
            </span>
          )}
        </div>
      )}

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          {emptyState?.icon ?? <IconDatabaseOff size={40} stroke={1.5} />}
          <span className="mt-3 text-sm font-bold  ">
            {emptyState?.message ?? "TIDAK ADA DATA DITEMUKAN"}
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}

      {footer && !isEmpty && (
        <div className="border-t border-border bg-gray-50 px-4 py-2">
          {footer}
        </div>
      )}
    </div>
  )
}

// Styled sub-components for consistent table styling within the shell
export const ShellTableStyles = {
  thead: "text-xs text-gray-500 font-semibold border-b border-border bg-gray-50/50",
  th: "px-4 py-2.5 text-left",
  tr: "border-b border-gray-100 hover:bg-gray-50 transition-colors",
  td: "px-4 py-2.5 text-sm",
} as const
