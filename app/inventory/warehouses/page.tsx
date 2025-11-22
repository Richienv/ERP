"use client"

import { useState } from "react"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
  Eye,
  MapPin,
  Warehouse,
  Package,
  Users,
  Settings,
  Boxes,
  Building2
} from "lucide-react"
import Link from "next/link"
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react"

// Mock data untuk warehouses - Textile Factory
const mockWarehouses = [
  {
    id: "1",
    code: "WH-MAT-001",
    name: "Gudang Bahan Baku Utama",
    address: "Jl. Industri Tekstil Raya No. 15, Blok A",
    city: "Bandung",
    province: "Jawa Barat",
    capacity: 50000,
    usedCapacity: 38500,
    totalProducts: 450,
    totalStockValue: 3250000000,
    managerId: "1",
    managerName: "Budi Santoso",
    isActive: true,
    locations: 45
  },
  {
    id: "2",
    code: "WH-PROD-001",
    name: "Gudang Produksi & WIP",
    address: "Jl. Industri Tekstil Raya No. 15, Blok B",
    city: "Bandung",
    province: "Jawa Barat",
    capacity: 25000,
    usedCapacity: 18200,
    totalProducts: 120,
    totalStockValue: 1650000000,
    managerId: "2",
    managerName: "Siti Rahayu",
    isActive: true,
    locations: 25
  },
  {
    id: "3",
    code: "WH-FIN-001",
    name: "Gudang Produk Jadi",
    address: "Jl. Industri Tekstil Raya No. 15, Blok C",
    city: "Bandung",
    province: "Jawa Barat",
    capacity: 30000,
    usedCapacity: 12500,
    totalProducts: 85,
    totalStockValue: 2800000000,
    managerId: "3",
    managerName: "Ahmad Wijaya",
    isActive: true,
    locations: 30
  },
  {
    id: "4",
    code: "WH-ACC-001",
    name: "Gudang Aksesori & Sparepart",
    address: "Jl. Industri Tekstil Raya No. 15, Blok D",
    city: "Bandung",
    province: "Jawa Barat",
    capacity: 5000,
    usedCapacity: 4200,
    totalProducts: 1200,
    totalStockValue: 450000000,
    managerId: null,
    managerName: "Dedi Kurniawan",
    isActive: true,
    locations: 15
  }
]

// Format currency helper
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

// Get capacity status
const getCapacityStatus = (used: number, total: number) => {
  const percentage = (used / total) * 100
  if (percentage >= 90) return { status: 'critical', color: 'bg-red-500' }
  if (percentage >= 70) return { status: 'warning', color: 'bg-yellow-500' }
  return { status: 'normal', color: 'bg-green-500' }
}

export default function WarehousesPage() {
  const [searchTerm, setSearchTerm] = useState("")

  // Filter warehouses
  const filteredWarehouses = mockWarehouses.filter(warehouse =>
    warehouse.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warehouse.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warehouse.city.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Calculate totals
  const totalCapacity = mockWarehouses.reduce((sum, w) => sum + w.capacity, 0)
  const totalUsed = mockWarehouses.reduce((sum, w) => sum + w.usedCapacity, 0)
  const totalValue = mockWarehouses.reduce((sum, w) => sum + w.totalStockValue, 0)
  const activeWarehouses = mockWarehouses.filter(w => w.isActive).length

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Kelola Gudang</h2>
          <p className="text-muted-foreground">
            Manajemen lokasi penyimpanan bahan baku dan produk jadi
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Gudang
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl:grid-cols-2 @5xl:grid-cols-4">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total Gudang</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {mockWarehouses.length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <Building2 className="mr-1 size-3" />
                Fasilitas
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              {activeWarehouses} gudang aktif <Warehouse className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Lokasi penyimpanan terdaftar
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Kapasitas Total</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {totalCapacity.toLocaleString('id-ID')}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <Package className="mr-1 size-3" />
                Unit
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              {Math.round((totalUsed / totalCapacity) * 100)}% terpakai <Boxes className="size-4" />
            </div>
            <div className="text-muted-foreground">
              {totalUsed.toLocaleString('id-ID')} unit tersimpan
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Nilai Aset Stok</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-blue-600">
              {formatCurrency(totalValue).replace(/\D00$/, '')}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-blue-600 text-blue-600">
                <IconTrendingUp />
                Valuasi
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-blue-600">
              Total nilai inventori <IconTrendingUp className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Akumulasi seluruh gudang
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Lokasi Rak</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {mockWarehouses.reduce((sum, w) => sum + w.locations, 0)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <MapPin className="mr-1 size-3" />
                Titik
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Titik penyimpanan <MapPin className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Rak dan area penyimpanan
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Warehouses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Fasilitas Gudang</CardTitle>
          <CardDescription>
            Monitor kapasitas dan status operasional setiap gudang
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari gudang, kode, atau lokasi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Warehouses Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Gudang</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead className="text-center">Kapasitas</TableHead>
                  <TableHead className="text-center">Item</TableHead>
                  <TableHead className="text-right">Nilai Stok</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWarehouses.map((warehouse) => {
                  const capacityStatus = getCapacityStatus(warehouse.usedCapacity, warehouse.capacity)
                  const capacityPercentage = (warehouse.usedCapacity / warehouse.capacity) * 100

                  return (
                    <TableRow key={warehouse.id}>
                      <TableCell className="font-medium">{warehouse.code}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{warehouse.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {warehouse.locations} lokasi rak
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{warehouse.city}</div>
                          <div className="text-xs text-muted-foreground">{warehouse.province}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {warehouse.managerName || "Belum ditugaskan"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center w-[200px]">
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span>{warehouse.usedCapacity.toLocaleString('id-ID')}</span>
                            <span className="text-muted-foreground">/ {warehouse.capacity.toLocaleString('id-ID')}</span>
                          </div>
                          <Progress
                            value={capacityPercentage}
                            className={`h-2 ${capacityPercentage > 90 ? "bg-red-100 [&>div]:bg-red-600" :
                                capacityPercentage > 75 ? "bg-yellow-100 [&>div]:bg-yellow-600" :
                                  "bg-green-100 [&>div]:bg-green-600"
                              }`}
                          />
                          <div className="text-xs text-muted-foreground text-right">
                            {Math.round(capacityPercentage)}% terpakai
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="font-medium">{warehouse.totalProducts}</div>
                        <div className="text-xs text-muted-foreground">jenis</div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(warehouse.totalStockValue).replace(/\D00$/, '')}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={warehouse.isActive ? "default" : "secondary"}>
                          {warehouse.isActive ? "Aktif" : "Nonaktif"}
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
                              <MapPin className="mr-2 h-4 w-4" />
                              Kelola Lokasi
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Settings className="mr-2 h-4 w-4" />
                              Pengaturan
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {filteredWarehouses.length === 0 && (
            <div className="text-center py-4">
              <p className="text-muted-foreground">Tidak ada gudang yang ditemukan</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}