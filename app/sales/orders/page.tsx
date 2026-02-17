"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Filter, Package, Plus, RefreshCcw, Search, ShoppingBag, Truck } from "lucide-react"
import { IconTrendingUp } from "@tabler/icons-react"
import { toast } from "sonner"

import { OrderExecutionCard } from "@/components/sales/order-execution-card"
import { Button } from "@/components/ui/button"
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
    <div className="space-y-6 p-4 md:p-6 lg:p-8 pt-6 w-full min-h-screen">

      {/* ═══════════════════════════════════════════ */}
      {/* COMMAND HEADER                              */}
      {/* ═══════════════════════════════════════════ */}
      <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900 rounded-none">
        <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-blue-500">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-6 w-6 text-blue-500" />
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                Manajemen Pesanan
              </h1>
              <p className="text-zinc-600 text-xs font-bold mt-0.5">
                Pusat komando sales order, fulfillment status, dan pengiriman.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={loadOrders}
              disabled={refreshing}
              className="h-9 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all rounded-none bg-white"
            >
              <RefreshCcw className={`mr-2 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button asChild className="h-9 bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase font-black text-[10px] tracking-wider hover:translate-y-[1px] hover:shadow-none transition-all rounded-none px-4">
              <Link href="/sales/orders/new">
                <Plus className="mr-2 h-3.5 w-3.5" />
                Pesanan Baru
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* KPI PULSE STRIP                            */}
      {/* ═══════════════════════════════════════════ */}
      <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden rounded-none">
        <div className="grid grid-cols-2 md:grid-cols-4">

          {/* Total Orders */}
          <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
            <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-800" />
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag className="h-4 w-4 text-zinc-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Pesanan</span>
            </div>
            <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900">
              {summary.totalOrders}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Semua Status</span>
            </div>
          </div>

          {/* Total Value */}
          <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
            <div className="flex items-center gap-2 mb-2">
              <IconTrendingUp className="h-4 w-4 text-zinc-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Order Value</span>
            </div>
            <div className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-600">
              {formatCurrencyCompact(summary.totalValue)}
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Revenue Pipeline</span>
            </div>
          </div>

          {/* In Progress */}
          <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-zinc-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Dalam Proses</span>
            </div>
            <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">
              {summary.confirmed + summary.inProgress}
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-[10px] font-bold text-blue-600 uppercase">Production & Packing</span>
            </div>
          </div>

          {/* Delivered */}
          <div className="relative p-4 md:p-5">
            <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500" />
            <div className="flex items-center gap-2 mb-2">
              <Truck className="h-4 w-4 text-zinc-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Terkirim / Selesai</span>
            </div>
            <div className="text-2xl md:text-3xl font-black tracking-tighter text-purple-600">
              {summary.delivered + summary.completed}
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-[10px] font-bold text-purple-600 uppercase">Fulfilled</span>
            </div>
          </div>

        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* MAIN CONTENT CONTAINER                      */}
      {/* ═══════════════════════════════════════════ */}
      <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white rounded-none flex flex-col min-h-[500px]">
        {/* Toolbar */}
        <div className="p-4 border-b-2 border-black flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-50">
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight">Execution Command Center</h2>
            <p className="text-xs font-bold text-zinc-500">Live feed produksi, WO generation, dan delivery progress</p>
          </div>

          <div className="flex items-center space-x-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-[320px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Cari pesanan..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9 border-2 border-zinc-200 focus-visible:ring-0 focus-visible:border-black font-bold h-10 rounded-none bg-white transition-all"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[1px] font-black uppercase text-[10px] tracking-wider h-10 px-4 rounded-none bg-white">
                  <Filter className="mr-2 h-4 w-4" /> Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none min-w-[200px]">
                <DropdownMenuLabel className="uppercase text-[10px] font-black tracking-widest text-zinc-500">Status</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-zinc-200" />
                <DropdownMenuItem onClick={() => setFilterStatus("all")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-none">Semua</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("DRAFT")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-none">Draft</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("CONFIRMED")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-none">Dikonfirmasi</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("IN_PROGRESS")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-none">Dalam Proses</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("DELIVERED")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-none">Terkirim</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("INVOICED")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-none">Ditagih</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("COMPLETED")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-none">Selesai</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("CANCELLED")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-none text-red-600">Dibatalkan</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 bg-zinc-100/30 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-300 bg-white rounded-none">
              <RefreshCcw className="h-10 w-10 text-zinc-300 animate-spin mb-4" />
              <p className="font-bold text-zinc-400">Memuat pesanan penjualan...</p>
            </div>
          ) : (
            <>
              {filteredOrders.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-zinc-300 bg-white rounded-none">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 border-2 border-zinc-200 mb-4">
                    <ShoppingBag className="h-8 w-8 text-zinc-400" />
                  </div>
                  <p className="text-zinc-500 font-bold text-lg">Tidak ada pesanan yang cocok.</p>
                  <p className="text-zinc-400 text-sm max-w-sm mx-auto mt-2">Coba ubah filter pencarian atau buat pesanan baru.</p>
                  <Button variant="outline" onClick={() => {
                    setSearchTerm("")
                    setFilterStatus("all")
                  }} className="mt-6 border-2 border-black font-bold uppercase text-[10px] tracking-wider rounded-none hover:bg-black hover:text-white">
                    Reset Filter
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
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
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
