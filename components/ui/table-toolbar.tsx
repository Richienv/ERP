"use client"

import { IconDownload, IconLayoutColumns } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Table } from "@tanstack/react-table"
import { exportTableToExcel } from "@/lib/table-export"

interface TableToolbarProps<T> {
  table: Table<T>
  exportFilename?: string
  children?: React.ReactNode
}

export function TableToolbar<T>({ table, exportFilename = "export", children }: TableToolbarProps<T>) {
  const selectedCount = table.getFilteredSelectedRowModel().rows.length

  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div className="flex items-center gap-2 flex-1">
        {children}
      </div>

      <div className="flex items-center gap-2">
        {selectedCount > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {selectedCount} dipilih
          </span>
        )}

        {/* Column Visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-none border-2 border-zinc-300 text-xs font-medium"
            >
              <IconLayoutColumns className="w-3.5 h-3.5 mr-1.5" />
              Kolom
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            {table
              .getAllColumns()
              .filter((col) => col.getCanHide())
              .map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(value) => col.toggleVisibility(!!value)}
                  className="text-xs capitalize"
                >
                  {typeof col.columnDef.header === "string" ? col.columnDef.header : col.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Export */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportTableToExcel(table, { filename: exportFilename })}
          className="h-8 rounded-none border-2 border-zinc-300 text-xs font-medium"
        >
          <IconDownload className="w-3.5 h-3.5 mr-1.5" />
          Export
        </Button>
      </div>
    </div>
  )
}
