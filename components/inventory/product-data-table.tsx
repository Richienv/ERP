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
  Trash2
} from "lucide-react"
import Link from "next/link"
import { StockStatusBadge, CurrencyDisplay } from "@/components/inventory"
import { formatNumber, getStockStatus } from "@/lib/inventory-utils"
import { type ProductWithRelations } from "@/lib/types"
import { ProductQuickView } from "@/components/inventory/product-quick-view"

// Add current stock to products (would come from stock levels in real app)
// Also override Decimal types to number for client usage
export type ProductWithStock = Omit<ProductWithRelations, 'costPrice' | 'sellingPrice' | 'manualBurnRate'> & {
  costPrice: number
  sellingPrice: number
  manualBurnRate: number
  currentStock: number
}

// Mock data - same as before but typed properly
const mockProducts: ProductWithStock[] = [
  {
    id: "1",
    code: "ELK001",
    name: "Laptop Dell Inspiron 15",
    description: "Laptop Dell Inspiron 15 dengan processor Intel Core i5",
    categoryId: "1",
    unit: "pcs",
    costPrice: 8500000,
    sellingPrice: 12000000,
    minStock: 10,
    maxStock: 50,
    reorderLevel: 15,
    barcode: "1234567890123",
    isActive: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-11-01"),
    leadTime: 3,
    safetyStock: 5,
    manualBurnRate: 0,
    manualAlert: false,
    alternativeProductId: null,
    currentStock: 25,
    category: {
      id: "1",
      code: "ELK",
      name: "Elektronik",
      description: "Peralatan elektronik",
      parentId: null,
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01")
    },
    _count: {
      stockLevels: 3,
      transactions: 15
    }
  },
  {
    id: "2",
    code: "FUR001",
    name: "Meja Kantor Eksekutif",
    description: "Meja kantor eksekutif dengan laci",
    categoryId: "2",
    unit: "pcs",
    costPrice: 2500000,
    sellingPrice: 3500000,
    minStock: 10,
    maxStock: 30,
    reorderLevel: 12,
    barcode: null,
    isActive: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-11-01"),
    currentStock: 8,
    leadTime: 5,
    safetyStock: 5,
    manualBurnRate: 0,
    manualAlert: false,
    alternativeProductId: null,
    category: {
      id: "2",
      code: "FUR",
      name: "Furniture",
      description: "Furniture kantor",
      parentId: null,
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01")
    },
    _count: {
      stockLevels: 2,
      transactions: 8
    }
  },
  // Add more products as needed...
]

// Add current stock to products (would come from stock levels in real app)

const productsWithStock: ProductWithStock[] = mockProducts.map(product => ({
  ...product,
  currentStock: product.code === "ELK001" ? 25 :
    product.code === "FUR001" ? 8 :
      Math.floor(Math.random() * 50),
}))

export const columns: ColumnDef<ProductWithStock>[] = [
  {
    accessorKey: "code",
    header: "Kode",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("code")}</div>
    ),
  },
  {
    accessorKey: "name",
    header: "Nama Produk",
    cell: ({ row }) => {
      const product = row.original
      return (
        <div>
          <div className="font-medium">{product.name}</div>
          {product.description && (
            <div className="text-xs text-muted-foreground line-clamp-1">
              {product.description}
            </div>
          )}
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
    accessorKey: "unit",
    header: "Satuan",
  },
  {
    accessorKey: "costPrice",
    header: "Harga Beli",
    cell: ({ row }) => (
      <CurrencyDisplay
        amount={row.getValue("costPrice")}
        className="text-right block"
      />
    ),
  },
  {
    accessorKey: "sellingPrice",
    header: "Harga Jual",
    cell: ({ row }) => (
      <CurrencyDisplay
        amount={row.getValue("sellingPrice")}
        className="text-right block"
      />
    ),
  },
  {
    id: "stock",
    header: "Stok",
    cell: ({ row }) => {
      const product = row.original
      const stockStatus = getStockStatus(product.currentStock, product.minStock, product.maxStock)

      return (
        <div className="text-center">
          <div className="font-medium">{formatNumber(product.currentStock)}</div>
          <div className="text-xs text-muted-foreground">
            Min: {product.minStock} | Max: {product.maxStock}
          </div>
        </div>
      )
    },
  },
  {
    id: "status",
    header: "Status Stok",
    cell: ({ row }) => {
      const product = row.original
      const stockStatus = getStockStatus(product.currentStock, product.minStock, product.maxStock)

      return (
        <div className="text-center">
          <StockStatusBadge status={stockStatus} />
        </div>
      )
    },
  },
  // Actions column is defined dynamically in the component below
]

function createActionsColumn(onQuickView: (id: string) => void): ColumnDef<ProductWithStock> {
    return {
        id: "actions",
        header: "Aksi",
        cell: ({ row }) => {
            const product = row.original
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
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onQuickView(product.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Lihat Detail & Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onClick={() => onQuickView(product.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Hapus
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    }
}

interface ProductDataTableProps {
  data: ProductWithStock[]
  categories?: { id: string; name: string; code: string }[]
}

export function ProductDataTable({ data, categories = [] }: ProductDataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [quickViewId, setQuickViewId] = React.useState<string | null>(null)
  const [quickViewOpen, setQuickViewOpen] = React.useState(false)

  const handleQuickView = React.useCallback((id: string) => {
    setQuickViewId(id)
    setQuickViewOpen(true)
  }, [])

  const allColumns = React.useMemo(
    () => [...columns, createActionsColumn(handleQuickView)],
    [handleQuickView]
  )

  const table = useReactTable({
    data,
    columns: allColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: "includesString",
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
  })

  return (
    <div className="w-full">
      <div className="flex items-center py-4 gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari produk, kode, atau kategori..."
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="pl-8"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Status Stok</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={columnFilters.find(f => f.id === "status")?.value === "normal"}
              onCheckedChange={(checked) => {
                if (checked) {
                  setColumnFilters([...columnFilters.filter(f => f.id !== "status"), { id: "status", value: "normal" }])
                } else {
                  setColumnFilters(columnFilters.filter(f => f.id !== "status"))
                }
              }}
            >
              Normal
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnFilters.find(f => f.id === "status")?.value === "low"}
              onCheckedChange={(checked) => {
                if (checked) {
                  setColumnFilters([...columnFilters.filter(f => f.id !== "status"), { id: "status", value: "low" }])
                } else {
                  setColumnFilters(columnFilters.filter(f => f.id !== "status"))
                }
              }}
            >
              Menipis
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnFilters.find(f => f.id === "status")?.value === "out"}
              onCheckedChange={(checked) => {
                if (checked) {
                  setColumnFilters([...columnFilters.filter(f => f.id !== "status"), { id: "status", value: "out" }])
                } else {
                  setColumnFilters(columnFilters.filter(f => f.id !== "status"))
                }
              }}
            >
              Habis Stok
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Settings2 className="mr-2 h-4 w-4" />
              Kolom
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Tampilkan Kolom</DropdownMenuLabel>
            <DropdownMenuSeparator />
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
                  Tidak ada produk ditemukan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} dari{" "}
          {table.getFilteredRowModel().rows.length} produk dipilih.
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

      <ProductQuickView
        productId={quickViewId}
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
        categories={categories}
      />
    </div>
  )
}

export default function ProductTablePage() {
  return <ProductDataTable data={productsWithStock} />
}