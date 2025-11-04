"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Package,
  AlertTriangle
} from "lucide-react"
import Link from "next/link"

// Mock data untuk products
const mockProducts = [
  {
    id: "1",
    code: "ELK001",
    name: "Laptop Dell Inspiron 15",
    category: "Elektronik",
    unit: "pcs",
    costPrice: 8500000,
    sellingPrice: 12000000,
    currentStock: 25,
    minStock: 10,
    maxStock: 50,
    status: "active",
    stockStatus: "normal"
  },
  {
    id: "2", 
    code: "FUR001",
    name: "Meja Kantor Eksekutif",
    category: "Furniture",
    unit: "pcs", 
    costPrice: 2500000,
    sellingPrice: 3500000,
    currentStock: 8,
    minStock: 10,
    maxStock: 30,
    status: "active",
    stockStatus: "low"
  },
  {
    id: "3",
    code: "OFF001", 
    name: "Printer HP LaserJet",
    category: "Peralatan Kantor",
    unit: "pcs",
    costPrice: 3200000,
    sellingPrice: 4500000,
    currentStock: 0,
    minStock: 5,
    maxStock: 20,
    status: "active", 
    stockStatus: "out"
  },
  {
    id: "4",
    code: "ELK002",
    name: "Mouse Wireless Logitech",
    category: "Elektronik",
    unit: "pcs",
    costPrice: 150000,
    sellingPrice: 250000,
    currentStock: 45,
    minStock: 20,
    maxStock: 100,
    status: "active",
    stockStatus: "normal"
  },
  {
    id: "5",
    code: "STA001",
    name: "Kertas A4 80gsm",
    category: "Stationery",
    unit: "rim",
    costPrice: 45000,
    sellingPrice: 65000,
    currentStock: 120,
    minStock: 50,
    maxStock: 200,
    status: "active",
    stockStatus: "normal"
  },
  {
    id: "6",
    code: "ELK003",
    name: "Keyboard Mechanical",
    category: "Elektronik", 
    unit: "pcs",
    costPrice: 450000,
    sellingPrice: 650000,
    currentStock: 3,
    minStock: 10,
    maxStock: 30,
    status: "active",
    stockStatus: "critical"
  }
]

// Format currency helper
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}

// Get stock status badge
const getStockStatusBadge = (stockStatus: string) => {
  switch (stockStatus) {
    case 'out':
      return <Badge variant="destructive">Habis Stok</Badge>
    case 'critical':
      return <Badge variant="destructive">Kritis</Badge>
    case 'low':
      return <Badge variant="secondary">Menipis</Badge>
    default:
      return <Badge variant="default">Normal</Badge>
  }
}

export default function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")

  // Filter products based on search and category
  const filteredProducts = mockProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = filterCategory === "all" || product.category === filterCategory
    return matchesSearch && matchesCategory
  })

  // Get unique categories for filter
  const categories = ["all", ...new Set(mockProducts.map(p => p.category))]

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Kelola Produk</h2>
          <p className="text-muted-foreground">
            Daftar dan kelola semua produk inventori
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link href="/inventory/products/new">
              <Plus className="mr-2 h-4 w-4" />
              Tambah Produk
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Produk</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockProducts.length}</div>
            <p className="text-xs text-muted-foreground">
              Produk aktif
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stok Normal</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {mockProducts.filter(p => p.stockStatus === 'normal').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Stok mencukupi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stok Menipis</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {mockProducts.filter(p => p.stockStatus === 'low' || p.stockStatus === 'critical').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Perlu restok
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Habis Stok</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {mockProducts.filter(p => p.stockStatus === 'out').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Stok kosong
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Produk</CardTitle>
          <CardDescription>
            Kelola produk dan monitor level stok
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari produk atau kode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Kategori: {filterCategory === "all" ? "Semua" : filterCategory}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filter Kategori</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {categories.map((category) => (
                  <DropdownMenuItem
                    key={category}
                    onClick={() => setFilterCategory(category)}
                  >
                    {category === "all" ? "Semua Kategori" : category}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Products Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Produk</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Satuan</TableHead>
                  <TableHead className="text-right">Harga Beli</TableHead>
                  <TableHead className="text-right">Harga Jual</TableHead>
                  <TableHead className="text-center">Stok</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.code}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>{product.unit}</TableCell>
                    <TableCell className="text-right">{formatCurrency(product.costPrice)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(product.sellingPrice)}</TableCell>
                    <TableCell className="text-center">
                      <div className="space-y-1">
                        <div className="font-medium">{product.currentStock}</div>
                        <div className="text-xs text-muted-foreground">
                          Min: {product.minStock} | Max: {product.maxStock}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {getStockStatusBadge(product.stockStatus)}
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
                          <DropdownMenuItem asChild>
                            <Link href={`/inventory/products/${product.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              Lihat Detail
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/inventory/products/${product.id}/edit`}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-4">
              <p className="text-muted-foreground">Tidak ada produk yang ditemukan</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}