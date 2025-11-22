"use client"

import { useState } from "react"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  MoreHorizontal,
  Edit,
  Plus,
  Minus,
  Package,
  Warehouse,
  AlertTriangle,
  Boxes,
  History
} from "lucide-react"
import Link from "next/link"
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react"

// Mock data untuk stock levels - Textile Factory
const mockStockLevels = [
  {
    id: "1",
    product: {
      id: "1",
      code: "FAB-CTN-001",
      name: "Kain Katun Combed 30s - Putih",
      unit: "roll"
    },
    warehouse: {
      id: "1",
      code: "WH-MAT-001",
      name: "Gudang Bahan Baku Utama"
    },
    quantity: 25,
    reservedQty: 5,
    availableQty: 20,
    minStock: 10,
    maxStock: 50,
    lastMovement: "2 hari lalu",
    status: "normal"
  },
  {
    id: "2",
    product: {
      id: "2",
      code: "FAB-DEN-001",
      name: "Kain Denim Raw 14oz",
      unit: "roll"
    },
    warehouse: {
      id: "1",
      code: "WH-MAT-001",
      name: "Gudang Bahan Baku Utama"
    },
    quantity: 8,
    reservedQty: 2,
    availableQty: 6,
    minStock: 15,
    maxStock: 60,
    lastMovement: "1 hari lalu",
    status: "low"
  },
  {
    id: "3",
    product: {
      id: "3",
      code: "ACC-BTN-001",
      name: "Kancing Kemeja 18L - Putih",
      unit: "gross"
    },
    warehouse: {
      id: "4",
      code: "WH-ACC-001",
      name: "Gudang Aksesori"
    },
    quantity: 0,
    reservedQty: 0,
    availableQty: 0,
    minStock: 50,
    maxStock: 200,
    lastMovement: "3 hari lalu",
    status: "out"
  },
  {
    id: "4",
    product: {
      id: "4",
      code: "THR-PLY-001",
      name: "Benang Polyester 40/2 - Hitam",
      unit: "cone"
    },
    warehouse: {
      id: "1",
      code: "WH-MAT-001",
      name: "Gudang Bahan Baku Utama"
    },
    quantity: 45,
    reservedQty: 3,
    availableQty: 42,
    minStock: 100,
    maxStock: 500,
    lastMovement: "4 jam lalu",
    status: "low"
  },
  {
    id: "5",
    product: {
      id: "5",
      code: "FAB-RAY-001",
      name: "Kain Rayon Viscose - Motif Bunga",
      unit: "roll"
    },
    warehouse: {
      id: "1",
      code: "WH-MAT-001",
      name: "Gudang Bahan Baku Utama"
    },
    quantity: 3,
    reservedQty: 1,
    availableQty: 2,
    minStock: 10,
    maxStock: 40,
    lastMovement: "6 jam lalu",
    status: "critical"
  }
]

// Get stock status badge
const getStockStatusBadge = (status: string) => {
  switch (status) {
    case 'out':
      return <Badge variant="destructive">Habis Stok</Badge>
    case 'critical':
      return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800">Kritis</Badge>
    case 'low':
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">Menipis</Badge>
    default:
      return <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800">Normal</Badge>
  }
}

export default function StockLevelsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterWarehouse, setFilterWarehouse] = useState("all")

  // Filter stock levels
  const filteredStockLevels = mockStockLevels.filter(stock => {
    const matchesSearch = stock.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stock.product.code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesWarehouse = filterWarehouse === "all" || stock.warehouse.id === filterWarehouse
    return matchesSearch && matchesWarehouse
  })

  // Get unique warehouses
  const warehouses = ["all", ...new Set(mockStockLevels.map(s => s.warehouse.id))]
  const warehouseMap = mockStockLevels.reduce((acc, stock) => {
    acc[stock.warehouse.id] = stock.warehouse.name
    return acc
  }, {} as Record<string, string>)

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Level Stok</h2>
          <p className="text-muted-foreground">
            Monitoring ketersediaan material kain, benang, dan aksesori
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" asChild>
            <Link href="/inventory/adjustments">
              <Edit className="mr-2 h-4 w-4" />
              Penyesuaian Stok
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl:grid-cols-2 @5xl:grid-cols-4">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total Item</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {mockStockLevels.length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <Package className="mr-1 size-3" />
                SKU
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Item terdaftar <Package className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Total SKU di semua gudang
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Stok Normal</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-green-600">
              {mockStockLevels.filter(s => s.status === 'normal').length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-green-600 text-green-600">
                <IconTrendingUp />
                Aman
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-green-600">
              Ketersediaan optimal <Boxes className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Siap untuk produksi
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Perlu Perhatian</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-yellow-600">
              {mockStockLevels.filter(s => s.status === 'low' || s.status === 'critical').length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-yellow-600 text-yellow-600">
                <IconTrendingDown />
                Pantau
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-yellow-600">
              Stok menipis <AlertTriangle className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Segera lakukan restock
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Habis Stok</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-red-600">
              {mockStockLevels.filter(s => s.status === 'out').length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-red-600 text-red-600">
                <IconTrendingDown />
                Kosong
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-red-600">
              Stok 0 unit <AlertTriangle className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Hambat jadwal produksi
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Stock Levels Table */}
      <Card>
        <CardHeader>
          <CardTitle>Status Stok Material</CardTitle>
          <CardDescription>
            Detail ketersediaan kain, benang, dan aksesori per lokasi gudang
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari material atau kode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Gudang: {filterWarehouse === "all" ? "Semua" : warehouseMap[filterWarehouse]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filter Gudang</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilterWarehouse("all")}>
                  Semua Gudang
                </DropdownMenuItem>
                {Object.entries(warehouseMap).map(([id, name]) => (
                  <DropdownMenuItem
                    key={id}
                    onClick={() => setFilterWarehouse(id)}
                  >
                    {name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Stock Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Material</TableHead>
                  <TableHead>Gudang</TableHead>
                  <TableHead className="text-center">Stok Total</TableHead>
                  <TableHead className="text-center">Tersedia</TableHead>
                  <TableHead className="text-center">Tereservasi</TableHead>
                  <TableHead className="text-center">Min/Max</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Update</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStockLevels.map((stock) => (
                  <TableRow key={stock.id}>
                    <TableCell className="font-medium">{stock.product.code}</TableCell>
                    <TableCell>{stock.product.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Warehouse className="mr-2 h-3 w-3" />
                        {stock.warehouse.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-medium">{stock.quantity} {stock.product.unit}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-medium text-green-600">{stock.availableQty}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-medium text-yellow-600">{stock.reservedQty}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-xs text-muted-foreground">
                        <div>Min: {stock.minStock}</div>
                        <div>Max: {stock.maxStock}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {getStockStatusBadge(stock.status)}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      <div className="flex items-center justify-center gap-1">
                        <History className="size-3" />
                        {stock.lastMovement}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
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
                          <DropdownMenuItem>
                            <Plus className="mr-2 h-4 w-4" />
                            Tambah Stok
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Minus className="mr-2 h-4 w-4" />
                            Kurangi Stok
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Penyesuaian
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredStockLevels.length === 0 && (
            <div className="text-center py-4">
              <p className="text-muted-foreground">Tidak ada data stok yang ditemukan</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}