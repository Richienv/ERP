"use client"

import { useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getSortedRowModel,
    getFilteredRowModel,
    type SortingState,
} from "@tanstack/react-table"

interface VirtualDataTableProps<TData> {
    data: TData[]
    columns: ColumnDef<TData, unknown>[]
    rowHeight?: number
    containerHeight?: number
    globalFilter?: string
}

export function VirtualDataTable<TData>({
    data,
    columns,
    rowHeight = 48,
    containerHeight = 600,
    globalFilter = "",
}: VirtualDataTableProps<TData>) {
    const parentRef = useRef<HTMLDivElement>(null)
    const [sorting, setSorting] = useState<SortingState>([])

    const table = useReactTable({
        data,
        columns,
        state: { sorting, globalFilter },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    })

    const { rows } = table.getRowModel()

    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => rowHeight,
        overscan: 15,
    })

    return (
        <div className="rounded-lg border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {/* Header */}
            <div className="border-b-2 border-black">
                {table.getHeaderGroups().map((headerGroup) => (
                    <div key={headerGroup.id} className="flex">
                        {headerGroup.headers.map((header) => (
                            <div
                                key={header.id}
                                className="flex-1 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-600 cursor-pointer select-none hover:bg-zinc-50"
                                style={{ width: header.getSize() }}
                                onClick={header.column.getToggleSortingHandler()}
                            >
                                {header.isPlaceholder
                                    ? null
                                    : flexRender(header.column.columnDef.header, header.getContext())}
                                {header.column.getIsSorted() === "asc" ? " ↑" : ""}
                                {header.column.getIsSorted() === "desc" ? " ↓" : ""}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Virtualized body */}
            <div
                ref={parentRef}
                className="overflow-auto"
                style={{ height: `${containerHeight}px` }}
            >
                <div
                    style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: "100%",
                        position: "relative",
                    }}
                >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                        const row = rows[virtualRow.index]
                        return (
                            <div
                                key={row.id}
                                className="absolute flex w-full items-center border-b border-zinc-200 hover:bg-zinc-50 transition-colors"
                                style={{
                                    height: `${rowHeight}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <div
                                        key={cell.id}
                                        className="flex-1 px-3 text-sm truncate"
                                        style={{ width: cell.column.getSize() }}
                                    >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </div>
                                ))}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Footer */}
            <div className="border-t-2 border-black px-3 py-2 text-xs text-zinc-500">
                {rows.length.toLocaleString("id-ID")} baris
            </div>
        </div>
    )
}
