"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Download, Filter, Package, Plus, RefreshCcw, Search, ShoppingBag, Truck } from "lucide-react"
import { IconTrendingUp } from "@tabler/icons-react"
import { useQueryClient } from "@tanstack/react-query"

import { useSalesOrders } from "@/hooks/use-sales-orders"
import { queryKeys } from "@/lib/query-keys"
import { exportToExcel } from "@/lib/table-export"
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

const formatCurrencyCompact = (value: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

export default function SalesOrdersPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, isFetching, refetch } = useSalesOrders()
  const orders = data?.orders ?? []
  const summary = data?.summary ?? {
    totalOrders: 0, totalValue: 0, draft: 0, confirmed: 0,
    inProgress: 0, delivered: 0, invoiced: 0, completed: 0, cancelled: 0,
  }

  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")

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
      <div className="border border-border shadow-sm overflow-hidden bg-white dark:bg-zinc-900 rounded-md">
        <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-blue-500">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-6 w-6 text-blue-500" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
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
              onClick={() => {
                const cols = [
                  { header: "No. Pesanan", accessorKey: "number" },
                  { header: "Customer", accessorKey: "customerName" },
                  { header: "Status", accessorKey: "status" },
                  { header: "Total", accessorKey: "totalAmount" },
                  { header: "No. Quotation", accessorKey: "quotationNumber" },
                  { header: "Tanggal", accessorKey: "orderDate" },
                ]
                const rows = filteredOrders.map((o: any) => ({
                  number: o.number,
                  customerName: o.customer?.name || "-",
                  status: o.status,
                  totalAmount: Number(o.totalAmount || 0),
                  quotationNumber: o.quotationNumber || "-",
                  orderDate: o.orderDate ? new Date(o.orderDate).toLocaleDateString("id-ID") : "-",
                }))
                exportToExcel(cols, rows as Record<string, unknown>[], { filename: "pesanan-penjualan" })
              }}
              className="h-9 border border-border font-bold text-xs shadow-sm hover:shadow-none transition-all rounded-md bg-white"
            >
              <Download className="mr-2 h-3.5 w-3.5" />
              Export
            </Button>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 border border-border font-bold text-xs shadow-sm hover:shadow-none transition-all rounded-md bg-white"
            >
              <RefreshCcw className={`mr-2 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button asChild className="h-9 bg-slate-900 text-white hover:bg-zinc-800 border border-border shadow-sm font-semibold text-xs hover:shadow-none transition-all rounded-md px-4">
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
      <div className="bg-white dark:bg-zinc-900 border border-border shadow-sm overflow-hidden rounded-md">
        <div className="grid grid-cols-2 md:grid-cols-4">

          {/* Total Orders */}
          <div className="relative p-4 md:p-5 md:border-r border-b md:border-b-0 border-zinc-100 dark:border-zinc-800">
            <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-800" />
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag className="h-4 w-4 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-500">Total Pesanan</span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-zinc-900">
              {summary.totalOrders}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-xs font-bold text-zinc-500 ">Semua Status</span>
            </div>
          </div>

          {/* Total Value */}
          <div className="relative p-4 md:p-5 md:border-r border-b md:border-b-0 border-zinc-100 dark:border-zinc-800">
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
            <div className="flex items-center gap-2 mb-2">
              <IconTrendingUp className="h-4 w-4 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-500">Order Value</span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-emerald-600">
              {formatCurrencyCompact(summary.totalValue)}
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-xs font-bold text-emerald-600 ">Revenue Pipeline</span>
            </div>
          </div>

          {/* In Progress */}
          <div className="relative p-4 md:p-5 md:border-r border-b md:border-b-0 border-zinc-100 dark:border-zinc-800">
            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-500">Dalam Proses</span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-blue-600">
              {summary.confirmed + summary.inProgress}
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-xs font-bold text-blue-600 ">Production & Packing</span>
            </div>
          </div>

          {/* Delivered */}
          <div className="relative p-4 md:p-5">
            <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500" />
            <div className="flex items-center gap-2 mb-2">
              <Truck className="h-4 w-4 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-500">Terkirim / Selesai</span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-purple-600">
              {summary.delivered + summary.completed}
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-xs font-bold text-purple-600 ">Fulfilled</span>
            </div>
          </div>

        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* MAIN CONTENT CONTAINER                      */}
      {/* ═══════════════════════════════════════════ */}
      <div className="border border-border shadow-sm bg-white rounded-md flex flex-col min-h-[500px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-50">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Execution Command Center</h2>
            <p className="text-xs font-bold text-zinc-500">Live feed produksi, WO generation, dan delivery progress</p>
          </div>

          <div className="flex items-center space-x-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-[320px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Cari pesanan..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9 border border-zinc-200 focus-visible:ring-0 focus-visible:border-border font-bold h-10 rounded-md bg-white transition-all"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border border-border shadow-sm hover:shadow-none font-semibold text-xs h-10 px-4 rounded-md bg-white">
                  <Filter className="mr-2 h-4 w-4" /> Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border border-border shadow-sm rounded-md min-w-[200px]">
                <DropdownMenuLabel className="text-xs font-semibold text-zinc-500">Status</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-zinc-200" />
                <DropdownMenuItem onClick={() => setFilterStatus("all")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-md">Semua</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("DRAFT")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-md">Draft</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("CONFIRMED")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-md">Dikonfirmasi</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("IN_PROGRESS")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-md">Dalam Proses</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("DELIVERED")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-md">Terkirim</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("INVOICED")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-md">Ditagih</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("COMPLETED")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-md">Selesai</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("CANCELLED")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-md text-red-600">Dibatalkan</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 bg-zinc-100/30 flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-300 bg-white rounded-md">
              <RefreshCcw className="h-10 w-10 text-zinc-300 animate-spin mb-4" />
              <p className="font-bold text-zinc-400">Memuat pesanan penjualan...</p>
            </div>
          ) : (
            <>
              {filteredOrders.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-zinc-300 bg-white rounded-md">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 border border-zinc-200 mb-4">
                    <ShoppingBag className="h-8 w-8 text-zinc-400" />
                  </div>
                  <p className="text-zinc-500 font-bold text-lg">Tidak ada pesanan yang cocok.</p>
                  <p className="text-zinc-400 text-sm max-w-sm mx-auto mt-2">Coba ubah filter pencarian atau buat pesanan baru.</p>
                  <Button variant="outline" onClick={() => {
                    setSearchTerm("")
                    setFilterStatus("all")
                  }} className="mt-6 border border-border font-bold text-xs rounded-md hover:bg-slate-900 hover:text-white">
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
                        queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all })
                        queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all })
                        queryClient.invalidateQueries({ queryKey: queryKeys.mfgDashboard.all })
                        queryClient.invalidateQueries({ queryKey: queryKeys.salesDashboard.all })
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
