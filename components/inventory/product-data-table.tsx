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
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Eye,
  Trash2,
  Package,
} from "lucide-react"
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
  status?: string // Added server status field
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
]

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
      <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">{row.getValue("code")}</span>
    ),
  },
  {
    accessorKey: "name",
    header: "Nama Produk",
    cell: ({ row }) => {
      const product = row.original
      return (
        <div>
          <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{product.name}</div>
          {product.description && (
            <div className="text-[10px] text-zinc-400 font-medium line-clamp-1 mt-0.5">
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
      const name = category ? category.name : "Tanpa Kategori"
      return (
        <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 border rounded-sm bg-emerald-50 border-emerald-200 text-emerald-700">
          {name}
        </span>
      )
    },
  },
  {
    accessorKey: "unit",
    header: "Satuan",
    cell: ({ row }) => (
      <span className="text-xs font-bold text-zinc-500 uppercase">{row.getValue("unit")}</span>
    ),
  },
  {
    accessorKey: "costPrice",
    header: "Harga Beli",
    cell: ({ row }) => (
      <CurrencyDisplay
        amount={row.getValue("costPrice")}
        className="text-right block font-mono text-sm font-bold"
      />
    ),
  },
  {
    accessorKey: "sellingPrice",
    header: "Harga Jual",
    cell: ({ row }) => (
      <CurrencyDisplay
        amount={row.getValue("sellingPrice")}
        className="text-right block font-mono text-sm font-bold"
      />
    ),
  },
  {
    id: "stock",
    header: "Stok",
    cell: ({ row }) => {
      const product = row.original

      return (
        <div className="text-center">
          <div className="font-mono font-black text-sm">{formatNumber(product.currentStock)}</div>
          <div className="text-[10px] text-zinc-400 font-medium mt-0.5">
            Min: {product.minStock} | Max: {product.maxStock}
          </div>
        </div>
      )
    },
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const product = row.original

      // Use server status if available, otherwise calculate
      let stockStatus: any = 'normal'

      if (product.status) {
        // Map server status (HEALTHY, LOW_STOCK, CRITICAL, NEW) to badge status (normal, low, critical, out)
        switch (product.status) {
          case 'CRITICAL':
            // If stock is 0, show 'out', otherwise 'critical'
            // But if it's manual alert, it's critical even if stock > 0
            stockStatus = product.currentStock === 0 ? 'out' : 'critical'
            break
          case 'LOW_STOCK':
            stockStatus = 'low'
            break
          case 'HEALTHY':
          case 'NEW':
          default:
            stockStatus = 'normal'
        }
      } else {
        // Fallback to client calculation
        stockStatus = getStockStatus(product.currentStock, product.minStock, product.maxStock)
      }

      return (
        <div className="text-center">
          <StockStatusBadge status={stockStatus} />
        </div>
      )
    },
  },
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

  const pageIndex = table.getState().pagination.pageIndex
  const pageCount = table.getPageCount()

  return (
    <div className="w-full space-y-4">
      {/* Search & Filter Bar */}
      <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                className="border-2 border-black h-10 pl-9 font-medium rounded-none"
                placeholder="Cari produk, kode, atau kategori..."
                value={globalFilter}
                onChange={(event) => setGlobalFilter(event.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="border-2 border-black font-bold uppercase text-[10px] tracking-wide h-10 px-4 rounded-none"
                >
                  <Filter className="mr-1.5 h-3.5 w-3.5" />
                  Filter Stok
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest">Status Stok</DropdownMenuLabel>
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
                <Button
                  variant="outline"
                  className="border-2 border-black font-bold uppercase text-[10px] tracking-wide h-10 px-4 rounded-none"
                >
                  <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                  Kolom
                  <ChevronDown className="ml-1.5 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest">Tampilkan Kolom</DropdownMenuLabel>
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
        </div>
      </div>

      {/* Table */}
      <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden flex flex-col">
        {/* Table Section Header */}
        <div className="bg-emerald-50 dark:bg-emerald-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-emerald-400">
          <Package className="h-4 w-4 text-emerald-600" />
          <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
            Daftar Produk
          </h3>
          <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 min-w-[20px] text-center rounded-sm">
            {table.getFilteredRowModel().rows.length}
          </span>
        </div>

        {/* Table Content */}
        <div className="w-full overflow-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-b-2 border-black bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-50">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 h-10">
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
                table.getRowModel().rows.map((row, idx) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={`hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10 transition-colors ${idx % 2 === 0 ? '' : 'bg-zinc-50/30 dark:bg-zinc-800/10'}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3">
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
                    colSpan={allColumns.length}
                    className="h-32 text-center"
                  >
                    <div className="flex flex-col items-center gap-2 text-zinc-400">
                      <Package className="h-6 w-6 text-zinc-300" />
                      <span className="text-xs font-bold uppercase tracking-widest">Tidak ada produk ditemukan</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-3 border-t-2 border-black flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
            {table.getFilteredRowModel().rows.length} produk
          </span>
          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-2 border-black"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-black min-w-[50px] text-center">
                {pageIndex + 1}/{pageCount}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-2 border-black"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
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
