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
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  FolderOpen,
  Package,
  Layers,
  Boxes,
  Tag
} from "lucide-react"
import { formatCurrency } from "@/lib/inventory-utils"
import { IconTrendingUp } from "@tabler/icons-react"

// Mock data untuk categories - Textile/Jeans Factory
const mockCategories = [
  {
    id: "1",
    code: "BAH-BAKU",
    name: "Bahan Baku",
    description: "Bahan utama untuk produksi tekstil dan jeans",
    parentId: null,
    parent: null,
    children: ["2", "3", "4"],
    totalProducts: 25,
    totalStockValue: 850000000,
    isActive: true,
    createdAt: "2024-01-15",
    level: 0
  },
  {
    id: "2",
    code: "KAIN",
    name: "Kain & Tekstil",
    description: "Berbagai jenis kain untuk produksi garment",
    parentId: "1",
    parent: "Bahan Baku",
    children: [],
    totalProducts: 12,
    totalStockValue: 580000000,
    isActive: true,
    createdAt: "2024-01-15",
    level: 1
  },
  {
    id: "3",
    code: "BENANG",
    name: "Benang & Thread",
    description: "Benang jahit dan bordir berbagai jenis",
    parentId: "1",
    parent: "Bahan Baku",
    children: [],
    totalProducts: 8,
    totalStockValue: 120000000,
    isActive: true,
    createdAt: "2024-01-15",
    level: 1
  },
  {
    id: "4",
    code: "AKSESORI",
    name: "Aksesori & Trim",
    description: "Kancing, zipper, label, dan aksesori lainnya",
    parentId: "1",
    parent: "Bahan Baku",
    children: [],
    totalProducts: 15,
    totalStockValue: 150000000,
    isActive: true,
    createdAt: "2024-01-15",
    level: 1
  },
  {
    id: "5",
    code: "PROD-JADI",
    name: "Produk Jadi",
    description: "Produk garment siap jual",
    parentId: null,
    parent: null,
    children: ["6", "7", "8"],
    totalProducts: 45,
    totalStockValue: 1250000000,
    isActive: true,
    createdAt: "2024-01-15",
    level: 0
  },
  {
    id: "6",
    code: "JEANS",
    name: "Jeans & Denim",
    description: "Produk jeans berbagai model dan ukuran",
    parentId: "5",
    parent: "Produk Jadi",
    children: [],
    totalProducts: 20,
    totalStockValue: 650000000,
    isActive: true,
    createdAt: "2024-01-15",
    level: 1
  },
  {
    id: "7",
    code: "JAKET",
    name: "Jaket & Outerwear",
    description: "Jaket jeans dan outerwear lainnya",
    parentId: "5",
    parent: "Produk Jadi",
    children: [],
    totalProducts: 15,
    totalStockValue: 420000000,
    isActive: true,
    createdAt: "2024-01-15",
    level: 1
  },
  {
    id: "8",
    code: "KEMEJA",
    name: "Kemeja & Shirt",
    description: "Kemeja denim dan casual shirt",
    parentId: "5",
    parent: "Produk Jadi",
    children: [],
    totalProducts: 10,
    totalStockValue: 180000000,
    isActive: true,
    createdAt: "2024-01-15",
    level: 1
  },
  {
    id: "9",
    code: "WIP",
    name: "Work in Process",
    description: "Barang setengah jadi dalam proses produksi",
    parentId: null,
    parent: null,
    children: [],
    totalProducts: 8,
    totalStockValue: 320000000,
    isActive: true,
    createdAt: "2024-01-15",
    level: 0
  },
  {
    id: "10",
    code: "LIMBAH",
    name: "Limbah & Sisa",
    description: "Sisa produksi dan limbah yang dapat dimanfaatkan",
    parentId: null,
    parent: null,
    children: [],
    totalProducts: 3,
    totalStockValue: 25000000,
    isActive: false,
    createdAt: "2024-01-15",
    level: 0
  }
]

export default function CategoriesPage() {
  const [searchTerm, setSearchTerm] = useState("")

  // Filter categories
  const filteredCategories = mockCategories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Calculate stats
  const totalCategories = mockCategories.length
  const activeCategories = mockCategories.filter(c => c.isActive).length
  const totalProducts = mockCategories.reduce((sum, c) => sum + c.totalProducts, 0)
  const totalValue = mockCategories.reduce((sum, c) => sum + c.totalStockValue, 0)

  const getCategoryIcon = (level: number) => {
    if (level === 0) return <FolderOpen className="h-4 w-4 text-blue-600" />
    return <Tag className="h-4 w-4 text-gray-600" />
  }

  const getCategoryRow = (category: any) => {
    const indent = category.level * 20
    return (
      <TableRow key={category.id}>
        <TableCell className="font-medium">
          <div className="flex items-center" style={{ paddingLeft: `${indent}px` }}>
            {getCategoryIcon(category.level)}
            <span className="ml-2">{category.code}</span>
          </div>
        </TableCell>
        <TableCell>
          <div>
            <div className="font-medium">{category.name}</div>
            {category.description && (
              <div className="text-xs text-muted-foreground line-clamp-1">
                {category.description}
              </div>
            )}
          </div>
        </TableCell>
        <TableCell>
          {category.parent ? (
            <Badge variant="outline" className="text-xs">
              {category.parent}
            </Badge>
          ) : (
            <Badge variant="default" className="text-xs">
              Root
            </Badge>
          )}
        </TableCell>
        <TableCell className="text-center">
          <div className="font-medium">{category.totalProducts}</div>
          <div className="text-xs text-muted-foreground">produk</div>
        </TableCell>
        <TableCell className="text-right">
          {formatCurrency(category.totalStockValue).replace(/\D00$/, '')}
        </TableCell>
        <TableCell className="text-center">
          <Badge variant={category.isActive ? "default" : "secondary"}>
            {category.isActive ? "Aktif" : "Nonaktif"}
          </Badge>
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
                <Eye className="mr-2 h-4 w-4" />
                Lihat Detail
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Plus className="mr-2 h-4 w-4" />
                Tambah Sub-kategori
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
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Kategori Produk</h2>
          <p className="text-muted-foreground">
            Klasifikasi bahan baku, produk jadi, dan aksesori
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Kategori
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl:grid-cols-2 @5xl:grid-cols-4">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total Kategori</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {totalCategories}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <Layers className="mr-1 size-3" />
                Grup
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              {activeCategories} kategori aktif <Layers className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Pengelompokan material
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total Item</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {totalProducts}
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
              Tersebar di semua kategori <Package className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Total SKU terdaftar
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Nilai Stok Kategori</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-blue-600">
              {formatCurrency(totalValue).replace(/\D00$/, '')}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-blue-600 text-blue-600">
                <IconTrendingUp />
                Aset
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-blue-600">
              Valuasi per kategori <IconTrendingUp className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Total nilai inventori
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Kategori Utama</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {mockCategories.filter(c => c.level === 0).length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <FolderOpen className="mr-1 size-3" />
                Root
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Induk kategori <FolderOpen className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Level teratas hierarki
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Categories Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Kategori</CardTitle>
          <CardDescription>
            Struktur hierarki kategori untuk pengorganisasian stok yang lebih baik
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari kategori, kode, atau deskripsi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Categories Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Kategori</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead className="text-center">Jumlah Produk</TableHead>
                  <TableHead className="text-right">Nilai Stok</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.map(getCategoryRow)}
              </TableBody>
            </Table>
          </div>

          {filteredCategories.length === 0 && (
            <div className="text-center py-4">
              <p className="text-muted-foreground">Tidak ada kategori yang ditemukan</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Structure Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Visualisasi Struktur</CardTitle>
          <CardDescription>
            Peta hierarki kategori bahan baku hingga produk jadi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mockCategories.filter(c => c.level === 0).map((parent) => (
              <div key={parent.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center space-x-2 mb-3">
                  <FolderOpen className="h-5 w-5 text-blue-600" />
                  <div>
                    <h4 className="font-semibold">{parent.name}</h4>
                    <p className="text-xs text-muted-foreground">{parent.code}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {mockCategories
                    .filter(c => c.parentId === parent.id)
                    .map((child) => (
                      <div key={child.id} className="flex items-center space-x-2 pl-4 py-1.5 bg-muted/30 rounded border border-transparent hover:border-border transition-colors">
                        <Tag className="h-3 w-3 text-gray-600" />
                        <span className="text-sm">{child.name}</span>
                        <Badge variant="secondary" className="text-[10px] h-5 ml-auto">
                          {child.totalProducts}
                        </Badge>
                      </div>
                    ))}
                </div>
                <div className="mt-4 pt-3 border-t grid grid-cols-2 gap-2">
                  <div className="text-xs">
                    <span className="text-muted-foreground block">Total Produk</span>
                    <span className="font-medium">{parent.totalProducts}</span>
                  </div>
                  <div className="text-xs text-right">
                    <span className="text-muted-foreground block">Nilai Stok</span>
                    <span className="font-medium text-blue-600">{formatCurrency(parent.totalStockValue).replace(/\D00$/, '')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}