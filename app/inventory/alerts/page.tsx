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
  Check,
  X,
  AlertTriangle,
  Package,
  Clock,
  Settings,
  Bell,
  ShieldAlert
} from "lucide-react"
import Link from "next/link"
import { IconTrendingDown } from "@tabler/icons-react"

// Mock data untuk stock alerts - Textile Factory
const mockStockAlerts = [
  {
    id: "1",
    product: {
      id: "1",
      code: "FAB-DEN-001",
      name: "Kain Denim Raw 14oz",
      currentStock: 8,
      minStock: 15,
      unit: "roll"
    },
    alertType: "LOW_STOCK",
    threshold: 15,
    isActive: true,
    createdAt: "2024-11-04T10:30:00Z",
    warehouse: "Gudang Bahan Baku",
    severity: "medium",
    daysSinceAlert: 2
  },
  {
    id: "2",
    product: {
      id: "3",
      code: "ACC-BTN-001",
      name: "Kancing Kemeja 18L - Putih",
      currentStock: 0,
      minStock: 50,
      unit: "gross"
    },
    alertType: "OUT_OF_STOCK",
    threshold: 0,
    isActive: true,
    createdAt: "2024-11-03T14:20:00Z",
    warehouse: "Gudang Aksesori",
    severity: "high",
    daysSinceAlert: 3
  },
  {
    id: "3",
    product: {
      id: "5",
      code: "FAB-RAY-001",
      name: "Kain Rayon Viscose - Motif",
      currentStock: 3,
      minStock: 10,
      unit: "roll"
    },
    alertType: "LOW_STOCK",
    threshold: 10,
    isActive: true,
    createdAt: "2024-11-05T08:15:00Z",
    warehouse: "Gudang Bahan Baku",
    severity: "high",
    daysSinceAlert: 0
  },
  {
    id: "4",
    product: {
      id: "4",
      code: "THR-PLY-001",
      name: "Benang Polyester 40/2",
      currentStock: 520,
      minStock: 100,
      maxStock: 500,
      unit: "cone"
    },
    alertType: "OVERSTOCK",
    threshold: 500,
    isActive: true,
    createdAt: "2024-11-02T16:45:00Z",
    warehouse: "Gudang Bahan Baku",
    severity: "low",
    daysSinceAlert: 4
  },
  {
    id: "5",
    product: {
      id: "6",
      code: "CHEM-DYE-001",
      name: "Pewarna Tekstil Indigo Blue",
      currentStock: 25,
      minStock: 20,
      unit: "kg",
      expiryDate: "2024-12-15"
    },
    alertType: "EXPIRY_WARNING",
    threshold: 45,
    isActive: true,
    createdAt: "2024-11-01T09:00:00Z",
    warehouse: "Gudang Kimia",
    severity: "medium",
    daysSinceAlert: 5
  }
]

// Get alert type badge
const getAlertTypeBadge = (alertType: string) => {
  switch (alertType) {
    case 'OUT_OF_STOCK':
      return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800">Habis Stok</Badge>
    case 'LOW_STOCK':
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">Stok Menipis</Badge>
    case 'OVERSTOCK':
      return <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">Kelebihan Stok</Badge>
    case 'EXPIRY_WARNING':
      return <Badge variant="default" className="bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800">Kedaluwarsa</Badge>
    default:
      return <Badge variant="outline">Unknown</Badge>
  }
}

// Get severity badge
const getSeverityBadge = (severity: string) => {
  switch (severity) {
    case 'high':
      return <Badge variant="destructive">Tinggi</Badge>
    case 'medium':
      return <Badge variant="secondary">Menengah</Badge>
    case 'low':
      return <Badge variant="outline">Rendah</Badge>
    default:
      return <Badge variant="outline">Unknown</Badge>
  }
}

// Format days since alert
const formatDaysSinceAlert = (days: number) => {
  if (days === 0) return "Hari ini"
  if (days === 1) return "1 hari lalu"
  return `${days} hari lalu`
}

export default function StockAlertsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterAlertType, setFilterAlertType] = useState("all")
  const [filterSeverity, setFilterSeverity] = useState("all")

  // Filter stock alerts
  const filteredAlerts = mockStockAlerts.filter(alert => {
    const matchesSearch = alert.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.product.code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesAlertType = filterAlertType === "all" || alert.alertType === filterAlertType
    const matchesSeverity = filterSeverity === "all" || alert.severity === filterSeverity
    return matchesSearch && matchesAlertType && matchesSeverity
  })

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Peringatan Stok</h2>
          <p className="text-muted-foreground">
            Notifikasi kritis untuk level stok dan kedaluwarsa material
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Konfigurasi
          </Button>
          <Button asChild>
            <Link href="/inventory/stock">
              <Package className="mr-2 h-4 w-4" />
              Cek Stok
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl:grid-cols-2 @5xl:grid-cols-4">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total Peringatan</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {mockStockAlerts.length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <Bell className="mr-1 size-3" />
                Aktif
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Perlu ditindaklanjuti <Bell className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Total notifikasi sistem
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Prioritas Tinggi</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-red-600">
              {mockStockAlerts.filter(a => a.severity === 'high').length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-red-600 text-red-600">
                <ShieldAlert className="mr-1 size-3" />
                Urgent
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-red-600">
              Tindakan segera <ShieldAlert className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Berdampak pada produksi
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Habis Stok</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-red-600">
              {mockStockAlerts.filter(a => a.alertType === 'OUT_OF_STOCK').length}
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
              Material tidak tersedia
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Baru Hari Ini</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-yellow-600">
              {mockStockAlerts.filter(a => a.daysSinceAlert === 0).length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-yellow-600 text-yellow-600">
                <Clock className="mr-1 size-3" />
                Baru
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-yellow-600">
              Muncul 24 jam terakhir <Clock className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Perlu review supervisor
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Stock Alerts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Notifikasi Inventori</CardTitle>
          <CardDescription>
            Monitoring anomali stok dan peringatan kedaluwarsa bahan baku
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
                  Jenis: {filterAlertType === "all" ? "Semua" : filterAlertType}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filter Jenis Peringatan</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilterAlertType("all")}>
                  Semua Jenis
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterAlertType("OUT_OF_STOCK")}>
                  Habis Stok
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterAlertType("LOW_STOCK")}>
                  Stok Menipis
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterAlertType("OVERSTOCK")}>
                  Kelebihan Stok
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterAlertType("EXPIRY_WARNING")}>
                  Peringatan Kedaluwarsa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Prioritas: {filterSeverity === "all" ? "Semua" : filterSeverity}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filter Prioritas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilterSeverity("all")}>
                  Semua Prioritas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterSeverity("high")}>
                  Tinggi
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterSeverity("medium")}>
                  Menengah
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterSeverity("low")}>
                  Rendah
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Alerts Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Material</TableHead>
                  <TableHead>Jenis Peringatan</TableHead>
                  <TableHead className="text-center">Stok Saat Ini</TableHead>
                  <TableHead className="text-center">Threshold</TableHead>
                  <TableHead className="text-center">Prioritas</TableHead>
                  <TableHead>Gudang</TableHead>
                  <TableHead className="text-center">Waktu</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="font-medium">{alert.product.code}</TableCell>
                    <TableCell>{alert.product.name}</TableCell>
                    <TableCell>
                      {getAlertTypeBadge(alert.alertType)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-medium">
                        {alert.product.currentStock} {alert.product.unit}
                      </div>
                      {alert.alertType === 'EXPIRY_WARNING' && alert.product.expiryDate && (
                        <div className="text-xs text-muted-foreground">
                          Exp: {new Date(alert.product.expiryDate).toLocaleDateString('id-ID')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-medium">{alert.threshold}</div>
                      {alert.alertType === 'LOW_STOCK' && (
                        <div className="text-xs text-muted-foreground">
                          Min: {alert.product.minStock}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {getSeverityBadge(alert.severity)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {alert.warehouse}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {formatDaysSinceAlert(alert.daysSinceAlert)}
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
                            <Check className="mr-2 h-4 w-4" />
                            Tandai Selesai
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/inventory/products/${alert.product.id}`}>
                              <Package className="mr-2 h-4 w-4" />
                              Lihat Detail
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/inventory/adjustments">
                              <Settings className="mr-2 h-4 w-4" />
                              Penyesuaian
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <X className="mr-2 h-4 w-4" />
                            Abaikan
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredAlerts.length === 0 && (
            <div className="text-center py-4">
              <p className="text-muted-foreground">Tidak ada peringatan yang ditemukan</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}