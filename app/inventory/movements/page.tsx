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
  Download,
  Package,
  ArrowRightLeft,
  History
} from "lucide-react"
import { MovementTypeIcon, getMovementTypeText } from "@/components/inventory"
import { formatCurrency } from "@/lib/inventory-utils"
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react"

// Mock data untuk stock movements - Textile/Jeans Factory
const mockMovements = [
  {
    id: "1",
    date: "2024-11-05T08:30:00Z",
    type: "IN" as const,
    product: {
      code: "DENIM001",
      name: "Kain Denim Stretch 14oz",
      unit: "meter"
    },
    warehouse: {
      name: "Gudang Bahan Baku",
      code: "GBB001"
    },
    quantity: 500,
    unitCost: 85000,
    totalValue: 42500000,
    reference: "PO-2024-1105",
    performedBy: "Siti Rahayu",
    notes: "Pengiriman dari supplier PT. Tekstil Nusantara"
  },
  {
    id: "2",
    date: "2024-11-05T09:15:00Z",
    type: "OUT" as const,
    product: {
      code: "JEAN001",
      name: "Jeans Skinny Fit Premium",
      unit: "pcs"
    },
    warehouse: {
      name: "Gudang Produk Jadi",
      code: "GPJ001"
    },
    quantity: 50,
    unitCost: 125000,
    totalValue: 6250000,
    reference: "SO-2024-0890",
    performedBy: "Ahmad Wijaya",
    notes: "Pengiriman ke distributor Jakarta"
  },
  {
    id: "3",
    date: "2024-11-05T10:45:00Z",
    type: "TRANSFER" as const,
    product: {
      code: "BTN001",
      name: "Kancing Logam Brass 15mm",
      unit: "gross"
    },
    warehouse: {
      name: "Gudang Aksesori → Produksi",
      code: "GAK001"
    },
    quantity: 25,
    unitCost: 35000,
    totalValue: 875000,
    reference: "TRF-2024-0156",
    performedBy: "Budi Santoso",
    notes: "Transfer untuk produksi batch J-2024-11"
  },
  {
    id: "4",
    date: "2024-11-05T11:20:00Z",
    type: "ADJUSTMENT" as const,
    product: {
      code: "THREAD001",
      name: "Benang Polyester 40s Hitam",
      unit: "cone"
    },
    warehouse: {
      name: "Gudang Bahan Baku",
      code: "GBB001"
    },
    quantity: -5,
    unitCost: 12000,
    totalValue: -60000,
    reference: "ADJ-2024-0089",
    performedBy: "Rina Kusuma",
    notes: "Penyesuaian stok - barang cacat produksi"
  },
  {
    id: "5",
    date: "2024-11-04T16:30:00Z",
    type: "IN" as const,
    product: {
      code: "ZIP001",
      name: "Zipper YKK Metal 18cm",
      unit: "pcs"
    },
    warehouse: {
      name: "Gudang Aksesori",
      code: "GAK001"
    },
    quantity: 1000,
    unitCost: 8500,
    totalValue: 8500000,
    reference: "PO-2024-1098",
    performedBy: "Dedi Kurniawan",
    notes: "Stok bulanan zipper untuk produksi"
  },
  {
    id: "6",
    date: "2024-11-04T14:15:00Z",
    type: "OUT" as const,
    product: {
      code: "JACKET001",
      name: "Jaket Jeans Oversized",
      unit: "pcs"
    },
    warehouse: {
      name: "Gudang Produk Jadi",
      code: "GPJ001"
    },
    quantity: 25,
    unitCost: 185000,
    totalValue: 4625000,
    reference: "SO-2024-0891",
    performedBy: "Indah Sari",
    notes: "Ekspor ke Malaysia - Batch Export-11"
  },
  {
    id: "7",
    date: "2024-11-04T13:00:00Z",
    type: "RESERVED" as const,
    product: {
      code: "DENIM002",
      name: "Kain Denim Raw Selvedge 16oz",
      unit: "meter"
    },
    warehouse: {
      name: "Gudang Bahan Baku",
      code: "GBB001"
    },
    quantity: 200,
    unitCost: 120000,
    totalValue: 24000000,
    reference: "RSV-2024-0234",
    performedBy: "Farid Rahman",
    notes: "Reservasi untuk order premium denim series"
  }
]

export default function StockMovementsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")

  // Filter movements
  const filteredMovements = mockMovements.filter(movement => {
    const matchesSearch =
      movement.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.product.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.reference.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === "all" || movement.type === filterType
    return matchesSearch && matchesType
  })

  // Calculate summary stats
  const totalIn = mockMovements
    .filter(m => m.type === 'IN')
    .reduce((sum, m) => sum + m.totalValue, 0)

  const totalOut = mockMovements
    .filter(m => m.type === 'OUT')
    .reduce((sum, m) => sum + Math.abs(m.totalValue), 0)

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'IN':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400">Masuk</Badge>
      case 'OUT':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400">Keluar</Badge>
      case 'TRANSFER':
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400">Transfer</Badge>
      case 'ADJUSTMENT':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400">Penyesuaian</Badge>
      case 'RESERVED':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400">Reservasi</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Pergerakan Stok</h2>
          <p className="text-muted-foreground">
            Riwayat dan tracking keluar masuk bahan baku & produk
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl:grid-cols-2 @5xl:grid-cols-4">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total Transaksi</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {mockMovements.length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <IconTrendingUp />
                Hari ini
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Aktivitas gudang <History className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Jumlah pergerakan tercatat
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Nilai Masuk</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-green-600">
              {formatCurrency(totalIn).replace(/\D00$/, '')}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-green-600 text-green-600">
                <IconTrendingUp />
                +12%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-green-600">
              Pembelian & Retur <IconTrendingUp className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Total nilai barang masuk
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Nilai Keluar</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-red-600">
              {formatCurrency(totalOut).replace(/\D00$/, '')}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-red-600 text-red-600">
                <IconTrendingDown />
                -8%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-red-600">
              Penjualan & Produksi <IconTrendingDown className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Total nilai barang keluar
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Net Movement</CardDescription>
            <CardTitle className={`text-2xl font-semibold tabular-nums @[250px]/card:text-3xl ${totalIn - totalOut >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              {formatCurrency(totalIn - totalOut).replace(/\D00$/, '')}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <ArrowRightLeft className="mr-1 size-3" />
                Selisih
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Perubahan nilai stok
            </div>
            <div className="text-muted-foreground">
              Selisih masuk dikurangi keluar
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Movements Table */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Transaksi Material</CardTitle>
          <CardDescription>
            Detail log pergerakan kain, benang, dan produk jadi antar gudang
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari material, kode, atau referensi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Tipe: {filterType === "all" ? "Semua" : getMovementTypeText(filterType)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filter Tipe</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilterType("all")}>
                  Semua Tipe
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType("IN")}>
                  Stok Masuk
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType("OUT")}>
                  Stok Keluar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType("TRANSFER")}>
                  Transfer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType("ADJUSTMENT")}>
                  Penyesuaian
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType("RESERVED")}>
                  Reservasi
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Movements Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal & Waktu</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Material / Produk</TableHead>
                  <TableHead>Gudang</TableHead>
                  <TableHead className="text-center">Jumlah</TableHead>
                  <TableHead className="text-right">Nilai Total</TableHead>
                  <TableHead>Referensi</TableHead>
                  <TableHead>Oleh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{new Date(movement.date).toLocaleDateString('id-ID')}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(movement.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <MovementTypeIcon type={movement.type} />
                        {getMovementBadge(movement.type)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{movement.product.name}</div>
                        <div className="text-xs text-muted-foreground">{movement.product.code}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{movement.warehouse.name}</div>
                        <div className="text-xs text-muted-foreground">{movement.warehouse.code}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className={`font-medium ${movement.quantity < 0 ? 'text-red-600' : movement.type === 'OUT' ? 'text-red-600' : 'text-green-600'}`}>
                        {movement.type === 'OUT' ? '-' : movement.quantity < 0 ? '' : '+'}{Math.abs(movement.quantity).toLocaleString('id-ID')}
                      </div>
                      <div className="text-xs text-muted-foreground">{movement.product.unit}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={`font-medium ${movement.totalValue < 0 ? 'text-red-600' : movement.type === 'OUT' ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(Math.abs(movement.totalValue)).replace(/\D00$/, '')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-mono">{movement.reference}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{movement.performedBy}</div>
                      {movement.notes && (
                        <div className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate" title={movement.notes}>
                          {movement.notes}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredMovements.length === 0 && (
            <div className="text-center py-4">
              <p className="text-muted-foreground">Tidak ada pergerakan stok yang ditemukan</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}