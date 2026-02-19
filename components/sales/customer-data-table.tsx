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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Search,
  Filter,
  Settings2,
  ChevronDown,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Building,
  User,
  CreditCard,
  AlertTriangle,
  CheckCircle
} from "lucide-react"
import Link from "next/link"

// Customer type definition (simplified - will be replaced with proper types later)
interface Customer {
  id: string
  code: string
  name: string
  legalName?: string
  customerType: 'INDIVIDUAL' | 'COMPANY' | 'GOVERNMENT'
  categoryId?: string
  npwp?: string
  nik?: string
  taxStatus: 'PKP' | 'NON_PKP' | 'EXEMPT'
  phone?: string
  email?: string
  creditLimit: number
  creditTerm: number
  paymentTerm: string
  creditStatus: 'GOOD' | 'WATCH' | 'HOLD' | 'BLOCKED'
  isActive: boolean
  isProspect: boolean
  lastOrderDate?: Date
  totalOrderValue: number
  createdAt: Date
  updatedAt: Date
  category?: {
    id: string
    code: string
    name: string
    description?: string
    isActive: boolean
  }
  addresses?: Array<{
    id: string
    type: string
    address1: string
    kelurahan?: string
    kecamatan?: string
    kabupaten: string
    provinsi: string
    postalCode: string
    isPrimary: boolean
  }>
  contacts?: Array<{
    id: string
    name: string
    title?: string
    email?: string
    phone?: string
    isPrimary: boolean
  }>
}

interface CustomerDataTableProps {
  data: Customer[]
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const getCustomerTypeIcon = (type: string) => {
  switch (type) {
    case 'COMPANY':
      return <Building className="h-4 w-4" />
    case 'GOVERNMENT':
      return <Building className="h-4 w-4 text-blue-600" />
    default:
      return <User className="h-4 w-4" />
  }
}

const getCustomerTypeName = (type: string) => {
  switch (type) {
    case 'COMPANY':
      return 'Perusahaan'
    case 'GOVERNMENT':
      return 'Pemerintah'
    case 'INDIVIDUAL':
      return 'Perorangan'
    default:
      return type
  }
}

const getCreditStatusBadge = (status: string) => {
  switch (status) {
    case 'GOOD':
      return <Badge variant="outline" className="text-green-600 border-green-600">
        <CheckCircle className="mr-1 h-3 w-3" />
        Baik
      </Badge>
    case 'WATCH':
      return <Badge variant="outline" className="text-yellow-600 border-yellow-600">
        <AlertTriangle className="mr-1 h-3 w-3" />
        Perhatian
      </Badge>
    case 'HOLD':
      return <Badge variant="outline" className="text-red-600 border-red-600">
        <AlertTriangle className="mr-1 h-3 w-3" />
        Ditahan
      </Badge>
    case 'BLOCKED':
      return <Badge variant="destructive">
        <AlertTriangle className="mr-1 h-3 w-3" />
        Diblokir
      </Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

const getTaxStatusName = (status: string) => {
  switch (status) {
    case 'PKP':
      return 'PKP'
    case 'NON_PKP':
      return 'Non PKP'
    case 'EXEMPT':
      return 'Bebas Pajak'
    default:
      return status
  }
}

const getPaymentTermName = (term: string) => {
  switch (term) {
    case 'CASH':
      return 'Tunai'
    case 'COD':
      return 'COD'
    case 'NET_15':
      return '15 Hari'
    case 'NET_30':
      return '30 Hari'
    case 'NET_45':
      return '45 Hari'
    case 'NET_60':
      return '60 Hari'
    case 'NET_90':
      return '90 Hari'
    default:
      return term
  }
}

const columns: ColumnDef<Customer>[] = [
  {
    accessorKey: "code",
    header: "Kode",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("code")}</div>
    ),
  },
  {
    accessorKey: "name",
    header: "Nama Pelanggan",
    cell: ({ row }) => {
      const customer = row.original
      const hasNoAddress = !customer.addresses || customer.addresses.length === 0
      const isIncomplete = !customer.phone && !customer.email && hasNoAddress
      return (
        <div className="flex items-center space-x-2">
          {getCustomerTypeIcon(customer.customerType)}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{customer.name}</span>
              {isIncomplete && (
                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-amber-100 border border-amber-400 text-amber-700 shrink-0">
                  Data Belum Lengkap
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {getCustomerTypeName(customer.customerType)}
              {customer.isProspect && (
                <Badge variant="outline" className="ml-1 text-xs">Prospek</Badge>
              )}
            </div>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "category.name",
    header: "Kategori",
    cell: ({ row }) => {
      const category = row.original.category
      return category ? category.name : "Tanpa Kategori"
    },
  },
  {
    id: "contact",
    header: "Kontak",
    cell: ({ row }) => {
      const customer = row.original
      const primaryAddress = customer.addresses?.find(addr => addr.isPrimary)
      
      return (
        <div className="text-sm">
          {customer.phone && (
            <div>{customer.phone}</div>
          )}
          {customer.email && (
            <div className="text-muted-foreground">{customer.email}</div>
          )}
          {primaryAddress && (
            <div className="text-xs text-muted-foreground">
              {primaryAddress.kabupaten}, {primaryAddress.provinsi}
            </div>
          )}
        </div>
      )
    },
  },
  {
    id: "taxInfo",
    header: "Info Pajak",
    cell: ({ row }) => {
      const customer = row.original
      return (
        <div className="text-sm">
          <div>{getTaxStatusName(customer.taxStatus)}</div>
          {customer.npwp && (
            <div className="text-xs text-muted-foreground font-mono">
              NPWP: {customer.npwp}
            </div>
          )}
          {customer.nik && (
            <div className="text-xs text-muted-foreground font-mono">
              NIK: {customer.nik}
            </div>
          )}
        </div>
      )
    },
  },
  {
    id: "creditInfo",
    header: "Info Kredit",
    cell: ({ row }) => {
      const customer = row.original
      return (
        <div className="text-sm">
          <div className="font-medium">{formatCurrency(customer.creditLimit)}</div>
          <div className="text-xs text-muted-foreground">
            {getPaymentTermName(customer.paymentTerm)}
          </div>
          <div className="mt-1">
            {getCreditStatusBadge(customer.creditStatus)}
          </div>
        </div>
      )
    },
  },
  {
    id: "orderInfo",
    header: "Info Pesanan",
    cell: ({ row }) => {
      const customer = row.original
      return (
        <div className="text-sm">
          <div className="font-medium">{formatCurrency(customer.totalOrderValue)}</div>
          {customer.lastOrderDate && (
            <div className="text-xs text-muted-foreground">
              Terakhir: {customer.lastOrderDate.toLocaleDateString('id-ID')}
            </div>
          )}
          {!customer.lastOrderDate && customer.isProspect && (
            <div className="text-xs text-muted-foreground">
              Belum ada pesanan
            </div>
          )}
        </div>
      )
    },
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const customer = row.original
      return (
        <div className="flex flex-col space-y-1">
          <Badge variant={customer.isActive ? "default" : "secondary"}>
            {customer.isActive ? "Aktif" : "Nonaktif"}
          </Badge>
        </div>
      )
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const customer = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Buka menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Aksi</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/sales/customers/${customer.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                Lihat Detail
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/sales/customers/${customer.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Pelanggan
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/sales/quotations/new?customerId=${customer.id}`}>
                <CreditCard className="mr-2 h-4 w-4" />
                Buat Penawaran
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export function CustomerDataTable({ data }: CustomerDataTableProps) {
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
      {/* Filters and Controls */}
      <div className="flex items-center py-4 space-x-2">
        <div className="flex-1 flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari pelanggan..."
              value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                table.getColumn("name")?.setFilterValue(event.target.value)
              }
              className="pl-8 max-w-sm"
            />
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              <Settings2 className="mr-2 h-4 w-4" />
              Kolom
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
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
                  Tidak ada data pelanggan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
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
            Selanjutnya
          </Button>
        </div>
      </div>
    </div>
  )
}