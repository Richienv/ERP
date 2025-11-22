"use client"

import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Package,
  AlertTriangle,
  Boxes,
  Search,
  Filter,
  Download
} from "lucide-react"
import Link from "next/link"
import { ProductDataTable } from "@/components/inventory/product-data-table"
import { getStockStatus } from "@/lib/inventory-utils"
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react"

// Mock data - Textile Factory Products
const mockProducts = [
  {
    id: "1",
    code: "FAB-CTN-001",
    name: "Kain Katun Combed 30s - Putih",
    description: "Kain katun combed 30s kualitas premium warna putih",
    categoryId: "1",
    unit: "roll",
    costPrice: 2500000,
    sellingPrice: 3200000,
    minStock: 10,
    maxStock: 50,
    reorderLevel: 15,
    barcode: "899123456001",
    isActive: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-11-01"),
    category: {
      id: "1",
      code: "FAB",
      name: "Kain Katun",
      description: "Bahan kain katun",
      parentId: null,
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01")
    },
    _count: {
      stockLevels: 3,
      stockMovements: 45
    },
    currentStock: 25
  },
  {
    id: "2",
    code: "FAB-DEN-001",
    name: "Kain Denim Raw 14oz",
    description: "Kain denim raw weight 14oz lebar 150cm",
    categoryId: "2",
    unit: "roll",
    costPrice: 3500000,
    sellingPrice: 4800000,
    minStock: 15,
    maxStock: 60,
    reorderLevel: 20,
    barcode: "899123456002",
    isActive: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-11-01"),
    category: {
      id: "2",
      code: "DEN",
      name: "Denim",
      description: "Bahan denim/jeans",
      parentId: null,
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01")
    },
    _count: {
      stockLevels: 2,
      stockMovements: 32
    },
    currentStock: 8
  },
  {
    id: "3",
    code: "ACC-BTN-001",
    name: "Kancing Kemeja 18L - Putih",
    description: "Kancing kemeja standar ukuran 18L warna putih",
    categoryId: "3",
    unit: "gross",
    costPrice: 45000,
    sellingPrice: 65000,
    minStock: 50,
    maxStock: 200,
    reorderLevel: 60,
    barcode: "899123456003",
    isActive: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-11-01"),
    category: {
      id: "3",
      code: "ACC",
      name: "Aksesori",
      description: "Aksesori garmen",
      parentId: null,
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01")
    },
    _count: {
      stockLevels: 1,
      stockMovements: 15
    },
    currentStock: 0
  },
  {
    id: "4",
    code: "THR-PLY-001",
    name: "Benang Polyester 40/2 - Hitam",
    description: "Benang jahit polyester ukuran 40/2 warna hitam",
    categoryId: "4",
    unit: "cone",
    costPrice: 15000,
    sellingPrice: 22000,
    minStock: 100,
    maxStock: 500,
    reorderLevel: 120,
    barcode: "899123456004",
    isActive: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-11-01"),
    category: {
      id: "4",
      code: "THR",
      name: "Benang",
      description: "Benang jahit",
      parentId: null,
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01")
    },
    _count: {
      stockLevels: 2,
      stockMovements: 88
    },
    currentStock: 45
  },
  {
    id: "5",
    code: "FAB-RAY-001",
    name: "Kain Rayon Viscose - Motif Bunga",
    description: "Kain rayon viscose motif bunga lebar 150cm",
    categoryId: "1",
    unit: "roll",
    costPrice: 2800000,
    sellingPrice: 3600000,
    minStock: 10,
    maxStock: 40,
    reorderLevel: 12,
    barcode: "899123456005",
    isActive: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-11-01"),
    category: {
      id: "1",
      code: "FAB",
      name: "Kain Rayon",
      description: "Bahan kain rayon",
      parentId: null,
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01")
    },
    _count: {
      stockLevels: 1,
      stockMovements: 12
    },
    currentStock: 3
  }
]

export default function ProductsPage() {
  // Calculate stats from data
  const totalProducts = mockProducts.length
  const normalStock = mockProducts.filter(p => getStockStatus(p.currentStock, p.minStock, p.maxStock) === 'normal').length
  const lowStock = mockProducts.filter(p => {
    const status = getStockStatus(p.currentStock, p.minStock, p.maxStock)
    return status === 'low' || status === 'critical'
  }).length
  const outOfStock = mockProducts.filter(p => getStockStatus(p.currentStock, p.minStock, p.maxStock) === 'out').length

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Kelola Material Kain</h2>
          <p className="text-muted-foreground">
            Daftar dan kelola semua stok kain, benang, dan aksesori
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button asChild>
            <Link href="/inventory/products/new">
              <Plus className="mr-2 h-4 w-4" />
              Tambah Material
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl:grid-cols-2 @5xl:grid-cols-4">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total Item Material</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {totalProducts}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <IconTrendingUp />
                +4.5%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Item aktif dalam sistem <Package className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Termasuk kain dan aksesori
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Stok Normal</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-green-600">
              {normalStock}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-green-600 text-green-600">
                <IconTrendingUp />
                Optimal
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-green-600">
              Ketersediaan aman <Boxes className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Siap untuk produksi
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Stok Menipis</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-yellow-600">
              {lowStock}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-yellow-600 text-yellow-600">
                <IconTrendingDown />
                Perhatian
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-yellow-600">
              Perlu restock segera <AlertTriangle className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Di bawah level minimum
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Habis Stok</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-red-600">
              {outOfStock}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-red-600 text-red-600">
                <IconTrendingDown />
                Kritis
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-red-600">
              Stok kosong <AlertTriangle className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Hambat produksi
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Products Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Material & Produk</CardTitle>
          <CardDescription>
            Kelola inventori kain, benang, dan aksesori dengan detail lengkap
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductDataTable data={mockProducts} />
        </CardContent>
      </Card>
    </div>
  )
}