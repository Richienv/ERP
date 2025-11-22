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

interface Sale {
  id: string
  invoiceNumber: string
  salesOrderNumber: string
  customer: Customer
  invoiceDate: Date
  dueDate: Date
  paidDate?: Date
  paymentTerm: 'CASH' | 'NET_15' | 'NET_30' | 'NET_45' | 'NET_60' | 'NET_90' | 'COD'
  status: 'PAID' | 'PARTIAL' | 'OUTSTANDING' | 'OVERDUE'
  subtotal: number
  taxAmount: number
  total: number
  paidAmount: number
  itemCount: number
  salesPerson: string
}

const statusConfig = {
  PAID: { label: 'Lunas', variant: 'default' as const, color: 'bg-green-100 text-green-800' },
  PARTIAL: { label: 'Sebagian', variant: 'secondary' as const, color: 'bg-yellow-100 text-yellow-800' },
  OUTSTANDING: { label: 'Belum Bayar', variant: 'secondary' as const, color: 'bg-blue-100 text-blue-800' },
  OVERDUE: { label: 'Terlambat', variant: 'destructive' as const, color: 'bg-red-100 text-red-800' }
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

export const columns: ColumnDef<Sale>[] = [
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
    accessorKey: "invoiceNumber",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          No. Invoice
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <div className="font-medium">
        <Link href={`/sales/invoices/${row.original.id}`} className="text-blue-600 hover:underline">
          {row.getValue("invoiceNumber")}
        </Link>
        <div className="text-xs text-muted-foreground">
          dari {row.original.salesOrderNumber}
        </div>
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
        <div className="text-xs text-muted-foreground">Sales: {row.original.salesPerson}</div>
      </div>
    ),
  },
  {
    accessorKey: "invoiceDate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Tgl Invoice
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const invoiceDate = row.getValue("invoiceDate") as Date
      const dueDate = row.original.dueDate
      const paidDate = row.original.paidDate
      return (
        <div>
          <div>{invoiceDate.toLocaleDateString('id-ID')}</div>
          <div className="text-xs text-muted-foreground">
            Jatuh tempo: {dueDate.toLocaleDateString('id-ID')}
          </div>
          {paidDate && (
            <div className="text-xs text-green-600">
              Dibayar: {paidDate.toLocaleDateString('id-ID')}
            </div>
          )}
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
      return (
        <div className="space-y-1">
          <Badge variant={config.variant}>{config.label}</Badge>
          <div className="text-xs text-muted-foreground">
            {paymentTermLabels[row.original.paymentTerm]}
          </div>
        </div>
      )
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
      const total = row.getValue("total") as number
      const paidAmount = row.original.paidAmount
      const outstanding = total - paidAmount
      
      return (
        <div className="text-right">
          <div className="font-medium">
            {new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(total)}
          </div>
          {outstanding > 0 && (
            <div className="text-xs text-red-600">
              Sisa: {new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(outstanding)}
            </div>
          )}
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
      const sale = row.original

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
              onClick={() => navigator.clipboard.writeText(sale.invoiceNumber)}
            >
              Salin No. Invoice
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <Link href={`/sales/invoices/${sale.id}`}>
              <DropdownMenuItem>Lihat Invoice</DropdownMenuItem>
            </Link>
            <DropdownMenuItem>Print Invoice</DropdownMenuItem>
            {sale.status !== 'PAID' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Catat Pembayaran</DropdownMenuItem>
                <DropdownMenuItem>Kirim Reminder</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

interface SalesDataTableProps {
  data: Sale[]
}

export function SalesDataTable({ data }: SalesDataTableProps) {
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
            placeholder="Cari invoice..."
            value={(table.getColumn("invoiceNumber")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("invoiceNumber")?.setFilterValue(event.target.value)
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
              <SelectItem value="PAID">Lunas</SelectItem>
              <SelectItem value="PARTIAL">Sebagian</SelectItem>
              <SelectItem value="OUTSTANDING">Belum Bayar</SelectItem>
              <SelectItem value="OVERDUE">Terlambat</SelectItem>
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
                  Belum ada data penjualan.
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