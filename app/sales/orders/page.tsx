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
  Eye,
  Plus,
  ShoppingBag,
  Truck,
  CheckCircle,
  Clock,
  Package,
  Calendar,
  Building2,
  FileText
} from "lucide-react"
import Link from "next/link"
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react"

// Mock data for sales orders - Textile Factory Context
const mockSalesOrders = [
  {
    id: '1',
    number: 'SO-2411-001',
    customer: {
      id: '1',
      name: 'PT. Garment Indah Jaya',
      code: 'CUST-001'
    },
    orderDate: '2024-11-15',
    requestedDate: '2024-11-25',
    status: 'CONFIRMED',
    paymentTerm: 'NET_30',
    subtotal: 150000000,
    taxAmount: 16500000,
    total: 166500000,
    itemCount: 3,
    quotationNumber: 'QT-2411-001',
    notes: "Kain Cotton Combed 30s - 500 Roll"
  },
  {
    id: '2',
    number: 'SO-2411-002',
    customer: {
      id: '2',
      name: 'CV. Tekstil Makmur',
      code: 'CUST-002'
    },
    orderDate: '2024-11-14',
    requestedDate: '2024-11-21',
    status: 'PROCESSING',
    paymentTerm: 'NET_15',
    subtotal: 85000000,
    taxAmount: 9350000,
    total: 94350000,
    itemCount: 2,
    quotationNumber: 'QT-2411-002',
    notes: "Jasa Celup Warna Navy - 2 Ton"
  },
  {
    id: '3',
    number: 'SO-2411-003',
    customer: {
      id: '3',
      name: 'Boutique Fashion A',
      code: 'CUST-003'
    },
    orderDate: '2024-11-13',
    requestedDate: '2024-11-18',
    status: 'DELIVERED',
    paymentTerm: 'CASH',
    subtotal: 52000000,
    taxAmount: 5720000,
    total: 57720000,
    itemCount: 1,
    quotationNumber: 'QT-2411-003',
    notes: "Kain Rayon Viscose - 100 Roll"
  },
  {
    id: '4',
    number: 'SO-2411-004',
    customer: {
      id: '4',
      name: 'UD. Kain Sejahtera',
      code: 'CUST-004'
    },
    orderDate: '2024-11-16',
    requestedDate: '2024-11-30',
    status: 'DRAFT',
    paymentTerm: 'NET_30',
    subtotal: 25000000,
    taxAmount: 2750000,
    total: 27750000,
    itemCount: 4,
    quotationNumber: null,
    notes: "Draft pesanan kain perca"
  },
  {
    id: '5',
    number: 'SO-2411-005',
    customer: {
      id: '1',
      name: 'PT. Garment Indah Jaya',
      code: 'CUST-001'
    },
    orderDate: '2024-11-17',
    requestedDate: '2024-11-24',
    status: 'SHIPPED',
    paymentTerm: 'NET_30',
    subtotal: 210000000,
    taxAmount: 23100000,
    total: 233100000,
    itemCount: 2,
    quotationNumber: 'QT-2411-006',
    notes: "Pengiriman batch 2 - Cotton 24s"
  }
]

// Get order status badge
const getOrderStatusBadge = (status: string) => {
  switch (status) {
    case 'DRAFT':
      return <Badge variant="secondary">Draft</Badge>
    case 'CONFIRMED':
      return <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">Terkonfirmasi</Badge>
    case 'PROCESSING':
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">Diproses</Badge>
    case 'SHIPPED':
      return <Badge variant="secondary" className="bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800">Dikirim</Badge>
    case 'DELIVERED':
      return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">Selesai</Badge>
    case 'CANCELLED':
      return <Badge variant="destructive">Dibatalkan</Badge>
    default:
      return <Badge variant="outline">Unknown</Badge>
  }
}

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

// Format date
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SalesOrdersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")

  // Filter orders
  const filteredOrders = mockSalesOrders.filter(order => {
    const matchesSearch = order.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.quotationNumber && order.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesStatus = filterStatus === "all" || order.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const orderStats = {
    totalOrders: mockSalesOrders.length,
    totalValue: mockSalesOrders.reduce((sum, order) => sum + order.total, 0),
    processingOrders: mockSalesOrders.filter(order => order.status === 'PROCESSING' || order.status === 'CONFIRMED').length,
    completedOrders: mockSalesOrders.filter(order => order.status === 'DELIVERED').length
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Pesanan Penjualan</h2>
          <p className="text-muted-foreground">
            Kelola pesanan masuk (SO), status produksi, dan pengiriman
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link href="/sales/orders/new">
              <Plus className="mr-2 h-4 w-4" />
              Pesanan Baru
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl:grid-cols-2 @5xl:grid-cols-4">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total Pesanan</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {orderStats.totalOrders}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <ShoppingBag className="mr-1 size-3" />
                Bulan Ini
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Semua Status <FileText className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Total Sales Order
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Nilai Transaksi</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-green-600">
              {formatCurrency(orderStats.totalValue).replace(/\D00$/, '')}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-green-600 text-green-600">
                <IconTrendingUp />
                Revenue
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-green-600">
              Total Omset <CheckCircle className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Estimasi pendapatan
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Sedang Diproses</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-blue-600">
              {orderStats.processingOrders}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-blue-600 text-blue-600">
                <Clock className="mr-1 size-3" />
                Aktif
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-blue-600">
              Produksi/Packing <Package className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Perlu dipantau
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Selesai Dikirim</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-purple-600">
              {orderStats.completedOrders}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-purple-600 text-purple-600">
                <Truck className="mr-1 size-3" />
                Delivered
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-purple-600">
              Tiba di Customer <CheckCircle className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Siap penagihan
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Sales Order</CardTitle>
          <CardDescription>
            Monitoring status pesanan dari konfirmasi hingga pengiriman
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nomor SO, customer, atau referensi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Status: {filterStatus === "all" ? "Semua" : filterStatus}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filter Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilterStatus("all")}>
                  Semua Status
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("DRAFT")}>
                  Draft
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("CONFIRMED")}>
                  Terkonfirmasi
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("PROCESSING")}>
                  Diproses
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("SHIPPED")}>
                  Dikirim
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("DELIVERED")}>
                  Selesai
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("CANCELLED")}>
                  Dibatalkan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Order Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-center">Tgl Order</TableHead>
                  <TableHead className="text-center">Tgl Kirim</TableHead>
                  <TableHead>Detail Pesanan</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      <div className="space-y-1">
                        <div className="flex items-center">
                          <ShoppingBag className="mr-2 h-3 w-3 text-muted-foreground" />
                          {order.number}
                        </div>
                        {order.quotationNumber && (
                          <div className="text-xs text-muted-foreground ml-5">
                            Ref: {order.quotationNumber}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{order.customer.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {formatDate(order.orderDate)}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {formatDate(order.requestedDate)}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="text-sm truncate" title={order.notes}>
                        {order.notes}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {order.itemCount} items
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-sm font-bold">{formatCurrency(order.total).replace(/\D00$/, '')}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      {getOrderStatusBadge(order.status)}
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
                            <Link href={`/sales/orders/${order.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              Lihat Detail
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/sales/orders/${order.id}/edit`}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <Truck className="mr-2 h-4 w-4" />
                            Buat Pengiriman
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <FileText className="mr-2 h-4 w-4" />
                            Buat Invoice
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-4">
              <p className="text-muted-foreground">Tidak ada pesanan yang ditemukan</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}