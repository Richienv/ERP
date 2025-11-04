"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Warehouse,
  BarChart3
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"

// Mock data untuk product detail
const getProductDetail = (id: string) => {
  // Simulasi data produk berdasarkan ID
  const mockProducts: { [key: string]: any } = {
    "1": {
      id: "1",
      code: "ELK001",
      name: "Laptop Dell Inspiron 15",
      description: "Laptop dengan spesifikasi tinggi untuk keperluan bisnis dan profesional. Dilengkapi dengan processor Intel Core i7, RAM 16GB, dan SSD 512GB.",
      category: "Elektronik",
      unit: "pcs",
      costPrice: 8500000,
      sellingPrice: 12000000,
      minimumStock: 10,
      maximumStock: 50,
      reorderPoint: 15,
      status: "active",
      createdAt: "2024-01-15",
      updatedAt: "2024-01-20"
    }
  }
  
  return mockProducts[id] || null
}

// Mock data untuk stock locations
const stockLocations = [
  {
    warehouse: "Gudang Utama",
    location: "A-01-01",
    quantity: 15,
    reserved: 2,
    available: 13,
    averageCost: 8500000
  },
  {
    warehouse: "Gudang Cabang",
    location: "B-02-03",
    quantity: 8,
    reserved: 1,
    available: 7,
    averageCost: 8500000
  },
  {
    warehouse: "Toko Retail",
    location: "DISPLAY-01",
    quantity: 2,
    reserved: 0,
    available: 2,
    averageCost: 8500000
  }
]

// Mock data untuk stock movements
const stockMovements = [
  {
    date: "2024-01-20",
    type: "IN",
    reason: "Purchase Order",
    reference: "PO-2024-001",
    quantity: 10,
    warehouse: "Gudang Utama",
    unitCost: 8500000
  },
  {
    date: "2024-01-18",
    type: "OUT",
    reason: "Sales Order",
    reference: "SO-2024-005",
    quantity: -3,
    warehouse: "Gudang Utama",
    unitCost: 8500000
  },
  {
    date: "2024-01-15",
    type: "TRANSFER",
    reason: "Internal Transfer",
    reference: "TR-2024-003",
    quantity: -5,
    warehouse: "Gudang Utama",
    unitCost: 8500000
  },
  {
    date: "2024-01-15",
    type: "TRANSFER",
    reason: "Internal Transfer",
    reference: "TR-2024-003",
    quantity: 5,
    warehouse: "Gudang Cabang",
    unitCost: 8500000
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

// Get movement type badge
const getMovementTypeBadge = (type: string) => {
  switch (type) {
    case 'IN':
      return <Badge className="bg-green-100 text-green-800">Masuk</Badge>
    case 'OUT':
      return <Badge className="bg-red-100 text-red-800">Keluar</Badge>
    case 'TRANSFER':
      return <Badge className="bg-blue-100 text-blue-800">Transfer</Badge>
    case 'ADJUSTMENT':
      return <Badge className="bg-yellow-100 text-yellow-800">Penyesuaian</Badge>
    default:
      return <Badge variant="secondary">{type}</Badge>
  }
}

export default function ProductDetailPage() {
  const params = useParams()
  const productId = params.id as string
  const [activeTab, setActiveTab] = useState("overview")

  const product = getProductDetail(productId)

  if (!product) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/inventory/products">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Produk Tidak Ditemukan</h2>
            <p className="text-muted-foreground">
              Produk dengan ID {productId} tidak ditemukan
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Calculate totals
  const totalStock = stockLocations.reduce((sum, loc) => sum + loc.quantity, 0)
  const totalReserved = stockLocations.reduce((sum, loc) => sum + loc.reserved, 0)
  const totalAvailable = stockLocations.reduce((sum, loc) => sum + loc.available, 0)
  const totalValue = totalStock * product.costPrice

  // Calculate stock status
  const getStockStatus = () => {
    if (totalAvailable === 0) return { status: "Habis Stok", color: "text-red-600" }
    if (totalAvailable <= product.reorderPoint) return { status: "Perlu Restok", color: "text-yellow-600" }
    if (totalAvailable <= product.minimumStock) return { status: "Stok Menipis", color: "text-orange-600" }
    return { status: "Stok Normal", color: "text-green-600" }
  }

  const stockStatus = getStockStatus()

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/inventory/products">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{product.name}</h2>
            <p className="text-muted-foreground">
              {product.code} • {product.category}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" asChild>
            <Link href={`/inventory/products/${productId}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" className="text-red-600 hover:text-red-700">
            <Trash2 className="mr-2 h-4 w-4" />
            Hapus
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stok</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStock}</div>
            <p className="text-xs text-muted-foreground">
              {totalReserved} reserved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stok Tersedia</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stockStatus.color}`}>{totalAvailable}</div>
            <p className={`text-xs ${stockStatus.color}`}>
              {stockStatus.status}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nilai Total</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-muted-foreground">
              Berdasarkan HPP
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lokasi</CardTitle>
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockLocations.length}</div>
            <p className="text-xs text-muted-foreground">
              Gudang aktif
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "overview"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("stock")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "stock"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
            }`}
          >
            Lokasi Stok
          </button>
          <button
            onClick={() => setActiveTab("movements")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "movements"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
            }`}
          >
            Riwayat Gerakan
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Product Information */}
          <Card>
            <CardHeader>
              <CardTitle>Informasi Produk</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Kode Produk</div>
                <div className="font-medium">{product.code}</div>
              </div>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground">Nama Produk</div>
                <div className="font-medium">{product.name}</div>
              </div>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground">Deskripsi</div>
                <div className="text-sm">{product.description}</div>
              </div>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground">Kategori</div>
                <div className="font-medium">{product.category}</div>
              </div>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground">Satuan</div>
                <div className="font-medium">{product.unit}</div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing & Stock Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Harga & Pengaturan Stok</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Harga Pokok Penjualan (HPP)</div>
                <div className="font-medium">{formatCurrency(product.costPrice)}</div>
              </div>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground">Harga Jual</div>
                <div className="font-medium">{formatCurrency(product.sellingPrice)}</div>
              </div>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground">Margin Keuntungan</div>
                <div className="font-medium text-green-600">
                  {((product.sellingPrice - product.costPrice) / product.sellingPrice * 100).toFixed(1)}%
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Stok Min</div>
                  <div className="font-medium">{product.minimumStock}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Stok Max</div>
                  <div className="font-medium">{product.maximumStock}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Reorder Point</div>
                  <div className="font-medium">{product.reorderPoint}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "stock" && (
        <Card>
          <CardHeader>
            <CardTitle>Lokasi Penyimpanan Stok</CardTitle>
            <CardDescription>
              Distribusi stok di berbagai gudang dan lokasi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gudang</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead className="text-center">Qty On Hand</TableHead>
                    <TableHead className="text-center">Reserved</TableHead>
                    <TableHead className="text-center">Available</TableHead>
                    <TableHead className="text-right">Avg Cost</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockLocations.map((location, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{location.warehouse}</TableCell>
                      <TableCell>{location.location}</TableCell>
                      <TableCell className="text-center">{location.quantity}</TableCell>
                      <TableCell className="text-center">{location.reserved}</TableCell>
                      <TableCell className="text-center font-medium">{location.available}</TableCell>
                      <TableCell className="text-right">{formatCurrency(location.averageCost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(location.quantity * location.averageCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "movements" && (
        <Card>
          <CardHeader>
            <CardTitle>Riwayat Pergerakan Stok</CardTitle>
            <CardDescription>
              History transaksi masuk, keluar, dan penyesuaian stok
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead>Referensi</TableHead>
                    <TableHead className="text-center">Quantity</TableHead>
                    <TableHead>Gudang</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockMovements.map((movement, index) => (
                    <TableRow key={index}>
                      <TableCell>{new Date(movement.date).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell>{getMovementTypeBadge(movement.type)}</TableCell>
                      <TableCell>{movement.reason}</TableCell>
                      <TableCell className="font-mono text-sm">{movement.reference}</TableCell>
                      <TableCell className={`text-center font-medium ${
                        movement.quantity > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                      </TableCell>
                      <TableCell>{movement.warehouse}</TableCell>
                      <TableCell className="text-right">{formatCurrency(movement.unitCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}