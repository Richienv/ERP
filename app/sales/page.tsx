"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter, CardAction } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  PlusCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Factory,
  ArrowRight
} from "lucide-react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { SalesActionCenter } from "@/components/sales-dashboard/sales-action-center"
import { SalesPipelineWidget } from "@/components/sales-dashboard/sales-pipeline"
import { OrderBookWidget } from "@/components/sales-dashboard/order-book"
import { ProductVariantWidget } from "@/components/sales-dashboard/product-variants"

export default function SalesDashboard() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 bg-zinc-50/50 dark:bg-black min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Command Center Penjualan</h2>
          <p className="text-muted-foreground">
            Monitor penjualan tekstil, kapasitas produksi, dan backlog order.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/sales/quotations/new">
              <FileText className="mr-2 h-4 w-4" /> Buat Penawaran
            </Link>
          </Button>
          <Button asChild>
            <Link href="/sales/orders/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Order Baru
            </Link>
          </Button>
        </div>
      </div>

      {/* Top Row: Textile Specific KPIs - Ritchie Minimal */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-black bg-zinc-50 dark:bg-zinc-900">
            <CardDescription className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Total Penjualan</CardDescription>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-black">Rp 2.45 M</CardTitle>
              <Badge variant="outline" className="bg-white text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <TrendingUp className="mr-1 h-3 w-3" /> +12.5%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground flex gap-1 items-center">
              <span className="font-black text-foreground">GROSS MARGIN:</span> <span className="text-emerald-600 font-bold">18.2%</span> (Target: 15%)
            </div>
          </CardContent>
        </Card>

        <Card className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-black bg-zinc-50 dark:bg-zinc-900">
            <CardDescription className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Order Book</CardDescription>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-black">Rp 3.8 M</CardTitle>
              <div className="h-8 w-8 rounded border border-black bg-white flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Factory className="h-4 w-4 text-black" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">
              <span className="font-black text-orange-600 uppercase">High Production Load</span>. Batches delayed.
            </div>
          </CardContent>
        </Card>

        <Card className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-black bg-zinc-50 dark:bg-zinc-900">
            <CardDescription className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Active Quotes</CardDescription>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-black">45 Quotes</CardTitle>
              <span className="text-xs font-black border border-black px-2 py-1 rounded bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Rp 5.2 M</span>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-2 w-full bg-zinc-100 border border-black rounded-full overflow-hidden mt-1">
              <div className="h-full bg-black" style={{ width: '45%' }} />
            </div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground mt-2">45% Hot Leads Probability</p>
          </CardContent>
        </Card>

        <Card className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-black bg-zinc-50 dark:bg-zinc-900">
            <CardDescription className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Piutang (AR)</CardDescription>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-black text-red-600">Rp 850 Jt</CardTitle>
              <Badge variant="destructive" className="h-5 text-[10px] border-black rounded-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">HIGH RISK</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground flex justify-between items-center border border-black/10 p-2 rounded bg-red-50">
              <span className="font-bold text-red-900 uppercase">Avg DSO Limit</span>
              <span className="font-black text-red-600">42 Days</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        {/* Visual Pipeline */}
        <SalesPipelineWidget />
        {/* Action Center - To Do List */}
        <SalesActionCenter />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        {/* Order Book vs Capacity */}
        <OrderBookWidget />
        {/* Product Variants Analysis */}
        <ProductVariantWidget />
      </div>

      {/* Tabs for Detailed Tables */}
      <Tabs defaultValue="orders" className="w-full">
        <TabsList>
          <TabsTrigger value="orders">Sales Orders Terkini</TabsTrigger>
          <TabsTrigger value="discounts">Diskon & Margin</TabsTrigger>
          <TabsTrigger value="risk">Resiko Pembayaran</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sales Orders Terbaru</CardTitle>
                  <CardDescription>Monitoring status order dan jadwal kirim.</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/sales/orders">Lihat Semua <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
            </CardHeader>
            {/* Placeholder for table, preserving clean layout */}
            <div className="p-6 text-center text-sm text-muted-foreground border-t bg-zinc-50/50">
              Widget tabel lengkap akan dimuat di sini...
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}