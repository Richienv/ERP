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
import { OrderExecutionCard } from "@/components/sales/order-execution-card"

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

      {/* Stats Cards - Ritchie Minimal */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-zinc-900 text-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400 font-bold uppercase tracking-wider text-xs">Total Pesanan</CardDescription>
            <div className="flex justify-between items-end">
              <CardTitle className="text-4xl font-black">{orderStats.totalOrders}</CardTitle>
              <div className="h-8 w-8 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                <ShoppingBag className="h-4 w-4 text-white" />
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Revenue</CardDescription>
            <div className="flex justify-between items-end">
              <CardTitle className="text-3xl font-black text-green-600">{formatCurrency(orderStats.totalValue).replace(/\D00$/, '')}</CardTitle>
              <div className="h-8 w-8 rounded bg-green-50 border border-green-200 flex items-center justify-center">
                <IconTrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Processing</CardDescription>
            <div className="flex justify-between items-end">
              <CardTitle className="text-4xl font-black text-blue-600">{orderStats.processingOrders}</CardTitle>
              <div className="h-8 w-8 rounded bg-blue-50 border border-blue-200 flex items-center justify-center">
                <Package className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardHeader>
          <CardFooter className="pt-0 pb-4">
            <div className="text-sm font-bold text-blue-600 animate-pulse">
              Live Production
            </div>
          </CardFooter>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Completed</CardDescription>
            <div className="flex justify-between items-end">
              <CardTitle className="text-3xl font-black text-purple-600">{orderStats.completedOrders}</CardTitle>
              <div className="h-8 w-8 rounded bg-purple-50 border border-purple-200 flex items-center justify-center">
                <Truck className="h-4 w-4 text-purple-600" />
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Orders List */}
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-black uppercase tracking-tight">Execution Command Center</CardTitle>
              <CardDescription className="text-base font-medium text-black/60">Live feed produksi dan pengiriman pesanan</CardDescription>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative w-full md:w-[300px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus-visible:ring-0"
                />
              </div>
              <Button variant="outline" className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold">
                <Filter className="mr-2 h-4 w-4" /> Filter
              </Button>
              <Button className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold bg-black text-white hover:bg-zinc-800" asChild>
                <Link href="/sales/orders/new">
                  <Plus className="mr-2 h-4 w-4" /> New Order
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <div className="space-y-1">
            {filteredOrders.map((order) => (
              <OrderExecutionCard key={order.id} order={order} />
            ))}
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-zinc-300 rounded-xl">
              <p className="text-muted-foreground font-medium text-lg">No orders found.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}