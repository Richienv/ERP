import Link from "next/link"
import { ArrowRight, CircleDollarSign, FileText, Package, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { prisma } from "@/lib/prisma"

const formatIDR = (value: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value)
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export default async function SalesDashboardPage() {
  const [
    monthlyRevenue,
    orderStats,
    quotationStats,
    leadStats,
    openAR,
    recentOrders,
    recentQuotations,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: {
        totalAmount: true,
      },
      where: {
        type: "INV_OUT",
        status: {
          notIn: ["CANCELLED", "VOID"],
        },
        issueDate: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
    prisma.salesOrder.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
      _sum: {
        total: true,
      },
    }),
    prisma.quotation.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
      _sum: {
        total: true,
      },
    }),
    prisma.lead.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
      _sum: {
        estimatedValue: true,
      },
    }),
    prisma.invoice.aggregate({
      _sum: {
        balanceDue: true,
      },
      where: {
        type: "INV_OUT",
        status: {
          in: ["ISSUED", "PARTIAL", "OVERDUE"],
        },
      },
    }),
    prisma.salesOrder.findMany({
      take: 8,
      orderBy: {
        orderDate: "desc",
      },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.quotation.findMany({
      take: 8,
      orderBy: {
        quotationDate: "desc",
      },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
      },
    }),
  ])

  const totalOrders = orderStats.reduce((sum, row) => sum + (row._count._all || 0), 0)
  const totalOrderValue = orderStats.reduce((sum, row) => sum + toNumber(row._sum.total), 0)
  const activeOrders = orderStats
    .filter((row) => ["CONFIRMED", "IN_PROGRESS", "DELIVERED", "INVOICED"].includes(row.status))
    .reduce((sum, row) => sum + (row._count._all || 0), 0)

  const activeQuotes = quotationStats
    .filter((row) => ["DRAFT", "SENT", "ACCEPTED"].includes(row.status))
    .reduce((sum, row) => sum + (row._count._all || 0), 0)

  const quotePipelineValue = quotationStats
    .filter((row) => ["DRAFT", "SENT", "ACCEPTED"].includes(row.status))
    .reduce((sum, row) => sum + toNumber(row._sum.total), 0)

  const totalLeads = leadStats.reduce((sum, row) => sum + (row._count._all || 0), 0)
  const openLeadValue = leadStats
    .filter((row) => !["WON", "LOST"].includes(row.status))
    .reduce((sum, row) => sum + toNumber(row._sum.estimatedValue), 0)

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 bg-zinc-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Command Center Penjualan</h2>
          <p className="text-muted-foreground">Monitor performa Sales, CRM pipeline, dan status eksekusi order.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/sales/quotations/new">
              <FileText className="mr-2 h-4 w-4" />
              Buat Quotation
            </Link>
          </Button>
          <Button asChild>
            <Link href="/sales/orders/new">
              <Package className="mr-2 h-4 w-4" />
              Buat Sales Order
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="pb-2">
            <CardDescription className="font-bold uppercase tracking-wide text-xs">Revenue Bulan Ini</CardDescription>
            <CardTitle className="text-2xl font-black text-emerald-700">{formatIDR(toNumber(monthlyRevenue._sum.totalAmount))}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="pb-2">
            <CardDescription className="font-bold uppercase tracking-wide text-xs">Sales Orders</CardDescription>
            <CardTitle className="text-2xl font-black">{totalOrders}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Value {formatIDR(totalOrderValue)}</CardContent>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="pb-2">
            <CardDescription className="font-bold uppercase tracking-wide text-xs">Order Aktif</CardDescription>
            <CardTitle className="text-2xl font-black text-blue-700">{activeOrders}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="pb-2">
            <CardDescription className="font-bold uppercase tracking-wide text-xs">Quotation Aktif</CardDescription>
            <CardTitle className="text-2xl font-black">{activeQuotes}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Pipeline {formatIDR(quotePipelineValue)}</CardContent>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="pb-2">
            <CardDescription className="font-bold uppercase tracking-wide text-xs">AR Outstanding</CardDescription>
            <CardTitle className="text-2xl font-black text-orange-700">{formatIDR(toNumber(openAR._sum.balanceDue))}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader>
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <Package className="h-5 w-5" />
              Sales Order Terbaru
            </CardTitle>
            <CardDescription>Order terbaru untuk koordinasi produksi dan pengiriman.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada sales order.</p>
            ) : recentOrders.map((order) => (
              <div key={order.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{order.number}</p>
                  <p className="text-sm text-muted-foreground">{order.customer.name} • {new Date(order.orderDate).toLocaleDateString("id-ID")}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatIDR(toNumber(order.total))}</p>
                  <p className="text-xs text-muted-foreground">{order.status}</p>
                </div>
              </div>
            ))}

            <Button variant="outline" className="w-full" asChild>
              <Link href="/sales/orders">
                Lihat Semua Sales Order
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader>
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <Users className="h-5 w-5" />
              CRM Snapshot
            </CardTitle>
            <CardDescription>Ringkasan pipeline lead dan quotation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase text-muted-foreground">Total Leads</p>
              <p className="text-2xl font-black">{totalLeads}</p>
              <p className="text-xs text-muted-foreground">Open value: {formatIDR(openLeadValue)}</p>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase text-muted-foreground">Recent Quotations</p>
              <div className="space-y-2 mt-2">
                {recentQuotations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada quotation.</p>
                ) : recentQuotations.slice(0, 4).map((quote) => (
                  <div key={quote.id} className="text-sm">
                    <p className="font-semibold">{quote.number}</p>
                    <p className="text-muted-foreground">{quote.customer.name} • {quote.status}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" asChild>
                <Link href="/sales/leads">CRM Leads</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/sales/quotations">Quotations</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader>
            <CardTitle className="text-base font-black flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4" />
              Link Cepat Keuangan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link href="/finance/invoices" className="block hover:underline">Penerimaan (AR)</Link>
            <Link href="/finance/journal" className="block hover:underline">Jurnal Umum</Link>
          </CardContent>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader>
            <CardTitle className="text-base font-black">Eksekusi Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link href="/sales/orders" className="block hover:underline">Sales Order Queue</Link>
            <Link href="/manufacturing" className="block hover:underline">Manufacturing Work Orders</Link>
          </CardContent>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader>
            <CardTitle className="text-base font-black">Master Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link href="/sales/customers" className="block hover:underline">Customer Master</Link>
            <Link href="/inventory" className="block hover:underline">Product & Stock Master</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
