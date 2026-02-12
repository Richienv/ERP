"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Filter, Package, Plus, RefreshCcw, Search, ShoppingBag, Truck } from "lucide-react"
import { IconTrendingUp } from "@tabler/icons-react"
import { toast } from "sonner"

import { OrderExecutionCard } from "@/components/sales/order-execution-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

interface SalesOrderItem {
  id: string
  number: string
  customer: {
    id: string
    code: string
    name: string
  }
  orderDate: string
  requestedDate: string | null
  status: string
  paymentTerm: string
  total: number
  itemCount: number
  notes: string
  quotationNumber: string | null
}

interface SalesOrderSummary {
  totalOrders: number
  totalValue: number
  draft: number
  confirmed: number
  inProgress: number
  delivered: number
  invoiced: number
  completed: number
  cancelled: number
}

interface SalesOrdersResponse {
  success: boolean
  data: SalesOrderItem[]
  summary?: SalesOrderSummary
  error?: string
}

const formatCurrencyCompact = (value: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrderItem[]>([])
  const [summary, setSummary] = useState<SalesOrderSummary>({
    totalOrders: 0,
    totalValue: 0,
    draft: 0,
    confirmed: 0,
    inProgress: 0,
    delivered: 0,
    invoiced: 0,
    completed: 0,
    cancelled: 0,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")

  const loadOrders = useCallback(async () => {
    setRefreshing(true)
    try {
      const response = await fetch("/api/sales/orders", {
        cache: "no-store",
      })
      const payload: SalesOrdersResponse = await response.json()
      if (!payload.success) {
        throw new Error(payload.error || "Gagal memuat sales order")
      }

      setOrders(payload.data || [])
      setSummary(payload.summary || {
        totalOrders: 0,
        totalValue: 0,
        draft: 0,
        confirmed: 0,
        inProgress: 0,
        delivered: 0,
        invoiced: 0,
        completed: 0,
        cancelled: 0,
      })
    } catch (error: any) {
      toast.error(error?.message || "Gagal memuat sales order")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const filteredOrders = useMemo(() => {
    const normalized = searchTerm.toLowerCase()
    return orders.filter((order) => {
      const matchesSearch =
        order.number.toLowerCase().includes(normalized)
        || order.customer.name.toLowerCase().includes(normalized)
        || (order.quotationNumber || "").toLowerCase().includes(normalized)

      const normalizedStatus = order.status === "PROCESSING" ? "IN_PROGRESS" : order.status
      const matchesStatus = filterStatus === "all" || normalizedStatus === filterStatus
      return matchesSearch && matchesStatus
    })
  }, [orders, searchTerm, filterStatus])

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Pesanan Penjualan</h2>
          <p className="text-muted-foreground">
            Kelola sales order end-to-end dari konfirmasi sampai pengiriman.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={loadOrders} disabled={refreshing}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/sales/orders/new">
              <Plus className="mr-2 h-4 w-4" />
              Pesanan Baru
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-zinc-900 text-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400 font-bold uppercase tracking-wider text-xs">Total Pesanan</CardDescription>
            <div className="flex justify-between items-end">
              <CardTitle className="text-4xl font-black">{summary.totalOrders}</CardTitle>
              <div className="h-8 w-8 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                <ShoppingBag className="h-4 w-4 text-white" />
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Order Value</CardDescription>
            <div className="flex justify-between items-end">
              <CardTitle className="text-3xl font-black text-green-600">{formatCurrencyCompact(summary.totalValue)}</CardTitle>
              <div className="h-8 w-8 rounded bg-green-50 border border-green-200 flex items-center justify-center">
                <IconTrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Dalam Proses</CardDescription>
            <div className="flex justify-between items-end">
              <CardTitle className="text-4xl font-black text-blue-600">{summary.confirmed + summary.inProgress}</CardTitle>
              <div className="h-8 w-8 rounded bg-blue-50 border border-blue-200 flex items-center justify-center">
                <Package className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Terkirim/Selesai</CardDescription>
            <div className="flex justify-between items-end">
              <CardTitle className="text-3xl font-black text-purple-600">{summary.delivered + summary.completed}</CardTitle>
              <div className="h-8 w-8 rounded bg-purple-50 border border-purple-200 flex items-center justify-center">
                <Truck className="h-4 w-4 text-purple-600" />
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-black uppercase tracking-tight">Execution Command Center</CardTitle>
              <CardDescription className="text-base font-medium text-black/60">Live feed produksi, WO generation, dan delivery progress</CardDescription>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative w-full md:w-[320px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari order..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-8 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold">
                    <Filter className="mr-2 h-4 w-4" /> Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="border-black">
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setFilterStatus("all")}>Semua</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("DRAFT")}>Draft</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("CONFIRMED")}>Confirmed</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("IN_PROGRESS")}>In Progress</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("DELIVERED")}>Delivered</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("INVOICED")}>Invoiced</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("COMPLETED")}>Completed</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("CANCELLED")}>Cancelled</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0">
          {loading ? (
            <div className="text-center py-12 border-2 border-dashed border-zinc-300 rounded-xl text-muted-foreground">
              Memuat sales order...
            </div>
          ) : (
            <>
              <div className="space-y-1">
                {filteredOrders.map((order) => (
                  <OrderExecutionCard
                    key={order.id}
                    order={order}
                    onWorkOrdersCreated={() => {
                      void loadOrders()
                    }}
                  />
                ))}
              </div>

              {filteredOrders.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-zinc-300 rounded-xl">
                  <p className="text-muted-foreground font-medium text-lg">Tidak ada order yang cocok.</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
