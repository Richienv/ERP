"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Search, Filter } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

interface Customer {
  id: string
  name: string
  code: string
}

interface SalesOrder {
  id: string
  number: string
  customer: Customer
  orderDate: Date
  requestedDate: Date
  confirmedDate?: Date
  status: 'DRAFT' | 'CONFIRMED' | 'IN_PROGRESS' | 'DELIVERED' | 'INVOICED' | 'COMPLETED' | 'CANCELLED'
  paymentTerm: 'CASH' | 'NET_15' | 'NET_30' | 'NET_45' | 'NET_60' | 'NET_90' | 'COD'
  subtotal: number
  taxAmount: number
  total: number
  itemCount: number
  quotationNumber?: string
}

const statusConfig = {
  DRAFT: { label: 'Draft', variant: 'secondary' as const },
  CONFIRMED: { label: 'Dikonfirmasi', variant: 'default' as const },
  IN_PROGRESS: { label: 'Dalam Proses', variant: 'default' as const },
  DELIVERED: { label: 'Terkirim', variant: 'default' as const },
  INVOICED: { label: 'Ditagih', variant: 'default' as const },
  COMPLETED: { label: 'Selesai', variant: 'default' as const },
  CANCELLED: { label: 'Dibatalkan', variant: 'destructive' as const }
}

const paymentTermLabels = {
  CASH: 'Tunai',
  NET_15: 'NET 15',
  NET_30: 'NET 30',
  NET_45: 'NET 45',
  NET_60: 'NET 60',
  NET_90: 'NET 90',
  COD: 'Bayar di Tempat'
}

export const columns: ColumnDef<SalesOrder>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "number",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          No. Pesanan
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <div className="font-medium">
        <Link href={`/sales/orders/${row.original.id}`} className="text-blue-600 hover:underline">
          {row.getValue("number")}
        </Link>
        {row.original.quotationNumber && (
          <div className="text-xs text-muted-foreground">
            dari {row.original.quotationNumber}
          </div>
        )}
      </div>
    ),
  },
  {
    accessorFn: (row) => row.customer.name,
    id: "customerName",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Customer
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.customer.name}</div>
        <div className="text-sm text-muted-foreground">{row.original.customer.code}</div>
      </div>
    ),
  },
  {
    accessorKey: "orderDate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Tgl Pesanan
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const date = row.getValue("orderDate") as Date
      return (
        <div>
          <div>{date.toLocaleDateString('id-ID')}</div>
          <div className="text-xs text-muted-foreground">
            Target: {row.original.requestedDate.toLocaleDateString('id-ID')}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as keyof typeof statusConfig
      const config = statusConfig[status]
      return <Badge variant={config.variant}>{config.label}</Badge>
    },
  },
  {
    accessorKey: "paymentTerm",
    header: "Pembayaran",
    cell: ({ row }) => {
      const term = row.getValue("paymentTerm") as keyof typeof paymentTermLabels
      return paymentTermLabels[term]
    },
  },
  {
    accessorKey: "total",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="justify-end"
        >
          Total
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("total"))
      return (
        <div className="text-right">
          <div className="font-medium">
            {new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(amount)}
          </div>
          <div className="text-xs text-muted-foreground">
            {row.original.itemCount} item
          </div>
        </div>
      )
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const order = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Aksi</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(order.id)}
            >
              Salin ID Pesanan
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <Link href={`/sales/orders/${order.id}`}>
              <DropdownMenuItem>Lihat Detail</DropdownMenuItem>
            </Link>
            <Link href={`/sales/orders/${order.id}/edit`}>
              <DropdownMenuItem>Edit Pesanan</DropdownMenuItem>
            </Link>
            {order.status === 'DRAFT' && (
              <DropdownMenuItem>Konfirmasi Pesanan</DropdownMenuItem>
            )}
            {order.status === 'CONFIRMED' && (
              <DropdownMenuItem>Mulai Proses</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

interface SalesOrderDataTableProps {
  data: SalesOrder[]
}

export function SalesOrderDataTable({ data }: SalesOrderDataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  return (
    <div className="w-full">
      <div className="flex items-center gap-4 py-4">
        <div className="flex items-center gap-2 flex-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari pesanan..."
            value={(table.getColumn("number")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("number")?.setFilterValue(event.target.value)
            }
            className="max-w-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={(table.getColumn("status")?.getFilterValue() as string) ?? ""}
            onValueChange={(value) =>
              table.getColumn("status")?.setFilterValue(value === "all" ? "" : value)
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="CONFIRMED">Dikonfirmasi</SelectItem>
              <SelectItem value="IN_PROGRESS">Dalam Proses</SelectItem>
              <SelectItem value="DELIVERED">Terkirim</SelectItem>
              <SelectItem value="INVOICED">Ditagih</SelectItem>
              <SelectItem value="COMPLETED">Selesai</SelectItem>
              <SelectItem value="CANCELLED">Dibatalkan</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Belum ada pesanan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} dari{" "}
          {table.getFilteredRowModel().rows.length} baris dipilih.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </div>
  )
}